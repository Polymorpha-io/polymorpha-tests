declare module "jstat" {
  // any justified: untyped vendor jStat global — declaration merging, no @types/jstat, used for distribution functions only
  const jStat: any;
  export default jStat;
}

declare module "pdfmake/interfaces" {
  // any justified: pdfmake TDocumentDefinitions is untyped vendor — @types/pdfmake not installed, used for doc definition pass-through
  export type TDocumentDefinitions = any;
}

declare module "pdfmake/build/pdfmake" {
  // any justified: pdfmake build is untyped vendor — no @types, used for getPdfMake lazy import
  const pdfMake: any;
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  // any justified: pdfmake vfs_fonts is untyped vendor — no @types, font bundle
  const pdfFonts: any;
  export default pdfFonts;
}
