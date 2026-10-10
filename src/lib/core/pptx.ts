import { utf8 } from './text';
import { EMU_PER_INCH, XML_HEADER, fitInto, xmlEscape } from './xml';
import { createZip, type ZipEntry } from './zip';

export type PptxSlide = { jpeg: Uint8Array; width: number; height: number; caption: string };

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'application/vnd.openxmlformats-officedocument.presentationml';
const SLIDE_W = Math.round(7.5 * EMU_PER_INCH);
const SLIDE_H = Math.round(10 * EMU_PER_INCH);

const rels = (items: [string, string, string][]) =>
  `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
    .join('')}</Relationships>`;

const emptyTree =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

const THEME =
  `${XML_HEADER}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="CaseSeal"><a:themeElements>` +
  '<a:clrScheme name="CaseSeal"><a:dk1><a:srgbClr val="0B1020"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
  '<a:dk2><a:srgbClr val="1C2440"/></a:dk2><a:lt2><a:srgbClr val="F3F5FB"/></a:lt2>' +
  '<a:accent1><a:srgbClr val="4F7CFF"/></a:accent1><a:accent2><a:srgbClr val="8B5CF6"/></a:accent2>' +
  '<a:accent3><a:srgbClr val="34D399"/></a:accent3><a:accent4><a:srgbClr val="FBBF24"/></a:accent4>' +
  '<a:accent5><a:srgbClr val="F87171"/></a:accent5><a:accent6><a:srgbClr val="66718F"/></a:accent6>' +
  '<a:hlink><a:srgbClr val="4F5DF5"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme>' +
  '<a:fontScheme name="CaseSeal"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
  '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
  '<a:fmtScheme name="CaseSeal"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
  '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
  '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
  '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>' +
  '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';

function slideXml(s: PptxSlide, index: number) {
  const margin = Math.round(0.35 * EMU_PER_INCH);
  const captionH = Math.round(0.5 * EMU_PER_INCH);
  const { width, height } = fitInto(s.width, s.height, SLIDE_W - margin * 2, SLIDE_H - margin * 2 - captionH);
  const x = Math.round((SLIDE_W - width) / 2);
  const y = margin;
  return (
    `${XML_HEADER}<p:sld ${NS}><p:cSld><p:spTree>${emptyTree}` +
    `<p:pic><p:nvPicPr><p:cNvPr id="2" name="Page ${index + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Caption"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${margin}" y="${SLIDE_H - margin - captionH}"/><a:ext cx="${SLIDE_W - margin * 2}" cy="${captionH}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1000"><a:solidFill><a:srgbClr val="555B6E"/></a:solidFill></a:rPr><a:t>${xmlEscape(s.caption)}</a:t></a:r></a:p></p:txBody></p:sp>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  );
}

/** Builds a .pptx with one portrait slide per page image. */
export function buildPptx(slides: PptxSlide[], title: string, createdAt: Date): Uint8Array {
  if (!slides.length) throw new Error('Nothing to export: this exhibit has no page images.');
  const entries: ZipEntry[] = [];
  const add = (name: string, xml: string) => entries.push({ name, data: utf8(xml) });

  add(
    '[Content_Types].xml',
    `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/>' +
      `<Override PartName="/ppt/presentation.xml" ContentType="${CT}.presentation.main+xml"/>` +
      `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT}.slideMaster+xml"/>` +
      `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${CT}.slideLayout+xml"/>` +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${CT}.slide+xml"/>`).join('') +
      '</Types>',
  );
  add(
    '_rels/.rels',
    rels([
      ['rId1', `${REL}/officeDocument`, 'ppt/presentation.xml'],
      ['rId2', 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', 'docProps/core.xml'],
    ]),
  );
  const iso = createdAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  add(
    'docProps/core.xml',
    `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${xmlEscape(title)}</dc:title><dc:creator>CaseSeal</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`,
  );
  add(
    'ppt/presentation.xml',
    `${XML_HEADER}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
      `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join('')}</p:sldIdLst>` +
      `<p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:defaultTextStyle/></p:presentation>`,
  );
  add(
    'ppt/_rels/presentation.xml.rels',
    rels([
      ['rId1', `${REL}/slideMaster`, 'slideMasters/slideMaster1.xml'],
      ['rId2', `${REL}/theme`, 'theme/theme1.xml'],
      ...slides.map((_, i): [string, string, string] => [`rId${i + 3}`, `${REL}/slide`, `slides/slide${i + 1}.xml`]),
    ]),
  );
  add(
    'ppt/slideMasters/slideMaster1.xml',
    `${XML_HEADER}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${emptyTree}</p:spTree></p:cSld>` +
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>',
  );
  add(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    rels([
      ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
      ['rId2', `${REL}/theme`, '../theme/theme1.xml'],
    ]),
  );
  add(
    'ppt/slideLayouts/slideLayout1.xml',
    `${XML_HEADER}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${emptyTree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  );
  add('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', `${REL}/slideMaster`, '../slideMasters/slideMaster1.xml']]));
  add('ppt/theme/theme1.xml', THEME);
  slides.forEach((s, i) => {
    add(`ppt/slides/slide${i + 1}.xml`, slideXml(s, i));
    add(
      `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      rels([
        ['rId1', `${REL}/slideLayout`, '../slideLayouts/slideLayout1.xml'],
        ['rId2', `${REL}/image`, `../media/page${i + 1}.jpeg`],
      ]),
    );
    entries.push({ name: `ppt/media/page${i + 1}.jpeg`, data: s.jpeg });
  });
  return createZip(entries, createdAt);
}
