import { utf8 } from './text';
import { EMU_PER_INCH, XML_HEADER, fitInto, xmlEscape } from './xml';
import { createZip, type ZipEntry } from './zip';

export type DocxPage = { jpeg?: Uint8Array; width: number; height: number; text?: string | null };

export type DocxInput = {
  title: string;
  /** Provenance lines printed under the title (case, exhibit, hashes). */
  meta: string[];
  pages: DocxPage[];
  includeImages: boolean;
  createdAt: Date;
};

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

function para(text: string, opts: { bold?: boolean; size?: number; color?: string; mono?: boolean } = {}) {
  const rPr = [
    opts.bold ? '<w:b/>' : '',
    opts.mono ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>' : '',
    opts.color ? `<w:color w:val="${opts.color}"/>` : '',
    opts.size ? `<w:sz w:val="${opts.size}"/>` : '',
  ].join('');
  return `<w:p><w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

function image(relId: string, id: number, cx: number, cy: number) {
  return (
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Page ${id}"/>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="page${id}.jpeg"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  );
}

/** Builds a .docx: title + provenance, then each page image followed by its recognised text. */
export function buildDocx(input: DocxInput): Uint8Array {
  const body: string[] = [para(input.title, { bold: true, size: 36 })];
  for (const line of input.meta) body.push(para(line, { size: 16, color: '555B6E', mono: /^[0-9a-f]{64}$/.test(line.split(' ').pop() ?? '') }));
  const media: ZipEntry[] = [];
  const rels: string[] = [];
  input.pages.forEach((p, i) => {
    body.push(pageBreak);
    body.push(para(`Page ${i + 1}`, { bold: true, size: 24 }));
    if (input.includeImages && p.jpeg) {
      const relId = `rIdImg${i + 1}`;
      const { width, height } = fitInto(p.width, p.height, 6.5 * EMU_PER_INCH, 8 * EMU_PER_INCH);
      media.push({ name: `word/media/page${i + 1}.jpeg`, data: p.jpeg });
      rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${i + 1}.jpeg"/>`);
      body.push(image(relId, i + 1, width, height));
    }
    const text = (p.text ?? '').trim();
    if (text) for (const line of text.split('\n')) body.push(para(line));
    else body.push(para('(No recognised text on this page.)', { color: '8A93AD' }));
  });

  const document =
    `${XML_HEADER}<w:document ${NS}><w:body>${body.join('')}` +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';
  const contentTypes =
    `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '</Types>';
  const rootRels =
    `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '</Relationships>';
  const docRels = `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;
  const iso = input.createdAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const core =
    `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${xmlEscape(input.title)}</dc:title><dc:creator>ScaniPro</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
    '</cp:coreProperties>';

  return createZip(
    [
      { name: '[Content_Types].xml', data: utf8(contentTypes) },
      { name: '_rels/.rels', data: utf8(rootRels) },
      { name: 'docProps/core.xml', data: utf8(core) },
      { name: 'word/document.xml', data: utf8(document) },
      { name: 'word/_rels/document.xml.rels', data: utf8(docRels) },
      ...media,
    ],
    input.createdAt,
  );
}
