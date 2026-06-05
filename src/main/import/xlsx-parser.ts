import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

// --- Hyperlink types ---

export interface Hyperlink {
  ref: string // e.g. "G9"
  target: string // URL
}

// --- Parsed row ---

export interface ParsedCell {
  value: unknown
  display?: string // formatted text (cell.w)
  type: string // 'n' | 's' | 'b'
}

export interface ParsedRow {
  rowIndex: number
  cells: ParsedCell[]
  hyperlinks: Map<string, string> // cellRef → URL
}

export interface ParsedSheet {
  name: string
  headerCells: ParsedCell[] // header row cells for column detection
  rows: ParsedRow[]
  hyperlinks: Map<string, string> // cellRef → URL (merged from XML)
  headerRow: number // 0-indexed row number of the header
  images: SheetImages | null // embedded images from drawing XML
}

// --- Internal XML parsing ---

function parseRelsXml(xml: string): Map<string, string> {
  const map = new Map<string, string>()
  // Match: <Relationship Id="rId2" ... Target="https://..." ... />
  const re =
    /<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"[^>]*TargetMode="External"[^>]*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    map.set(m[1], m[2])
  }
  return map
}

function parseHyperlinksXml(xml: string): Array<{ ref: string; rId: string }> {
  const results: Array<{ ref: string; rId: string }> = []
  // Match: <hyperlink r:id="rId2" ref="G9"/>
  // Note: attribute order may vary
  const re = /<hyperlink[^>]*ref="([^"]*)"[^>]*r:id="([^"]*)"[^>]*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    results.push({ ref: m[1], rId: m[2] })
  }
  // Also try reverse attribute order
  const re2 = /<hyperlink[^>]*r:id="([^"]*)"[^>]*ref="([^"]*)"[^>]*\/>/g
  while ((m = re2.exec(xml)) !== null) {
    // Avoid duplicates
    if (!results.find((r) => r.ref === m![2] && r.rId === m![1])) {
      results.push({ ref: m[2], rId: m[1] })
    }
  }
  return results
}

function sheetIndexToRef(index: number): string {
  // 0 → A, 1 → B, ..., 25 → Z, 26 → AA
  let col = ''
  let n = index
  while (n >= 0) {
    col = String.fromCharCode(65 + (n % 26)) + col
    n = Math.floor(n / 26) - 1
  }
  return col
}

// --- Drawing XML parsing (embedded images) ---

function parseDrawingRelsXml(xml: string): Map<string, string> {
  const map = new Map<string, string>()
  // Match: <Relationship Id="rId42" ... Target="../media/image42.jpg"/>
  const re =
    /<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"[^>]*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    map.set(m[1], m[2])
  }
  return map
}

function parseDrawingXml(xml: string): Array<{ row: number; col: number; rId: string }> {
  const results: Array<{ row: number; col: number; rId: string }> = []
  // Match each <xdr:oneCellAnchor> block
  const anchorRe = /<xdr:oneCellAnchor>([\s\S]*?)<\/xdr:oneCellAnchor>/g
  let anchor: RegExpExecArray | null
  while ((anchor = anchorRe.exec(xml)) !== null) {
    const block = anchor[1]

    // Extract row and col from <xdr:from>
    const rowMatch = block.match(/<xdr:row>(\d+)<\/xdr:row>/)
    const colMatch = block.match(/<xdr:col>(\d+)<\/xdr:col>/)
    const rIdMatch = block.match(/<a:blip[^>]*r:embed="([^"]*)"/)

    if (rowMatch && colMatch && rIdMatch) {
      results.push({
        row: parseInt(rowMatch[1], 10),
        col: parseInt(colMatch[1], 10),
        rId: rIdMatch[1]
      })
    }
  }
  return results
}

export function extractSheetImages(
  filePath: string,
  sheetIndex: number,
  _headerRow: number
): SheetImages {
  function extractFromZip(entryPath: string): string {
    try {
      const result = execSync(
        `unzip -p "${filePath}" "${entryPath}" 2>/dev/null`,
        { maxBuffer: 10 * 1024 * 1024 }
      )
      return result.toString('utf-8')
    } catch {
      return ''
    }
  }

  const sheetNum = sheetIndex + 1
  const drawingXml = extractFromZip(`xl/drawings/drawing${sheetNum}.xml`)
  const drawingRelsXml = extractFromZip(`xl/drawings/_rels/drawing${sheetNum}.xml.rels`)

  if (!drawingXml || !drawingRelsXml) {
    return { imageMap: new Map(), extractable: [] }
  }

  const relsMap = parseDrawingRelsXml(drawingRelsXml)
  const anchors = parseDrawingXml(drawingXml)

  const imageMap = new Map<number, EmbeddedImage[]>()
  const extractable: Array<{ row: number; col: number; path: string }> = []

  for (const anchor of anchors) {
    const relativeTarget = relsMap.get(anchor.rId)
    if (!relativeTarget) continue

    // Convert relative path to absolute xlsx path
    // "../media/image42.jpg" → "xl/media/image42.jpg"
    const imagePath = relativeTarget.replace(/^\.\.\//, 'xl/')

    const image: EmbeddedImage = {
      rowIndex: anchor.row,
      colIndex: anchor.col,
      imagePath
    }

    const existing = imageMap.get(anchor.row)
    if (existing) {
      existing.push(image)
    } else {
      imageMap.set(anchor.row, [image])
    }

    extractable.push({ row: anchor.row, col: anchor.col, path: imagePath })
  }

  return { imageMap, extractable }
}

// --- Main parser ---

export interface SpreadsheetData {
  sheets: ParsedSheet[]
}

export interface ParseOptions {
  /** When true, include rows even if they don't have a year value */
  includeAllRows?: boolean
}

export function parseSpreadsheet(filePath: string, options?: ParseOptions): SpreadsheetData {
  const fileBuf = readFileSync(filePath)
  const wb = XLSX.read(fileBuf, { type: 'buffer', cellStyles: true, cellDates: false })

  // Extract XML files from xlsx (which is a zip archive)
  function extractXmlFromZip(entryPath: string): string {
    try {
      // Use unzip to extract a specific file to stdout
      const result = execSync(
        `unzip -p "${filePath}" "${entryPath}" 2>/dev/null`,
        { maxBuffer: 10 * 1024 * 1024 }
      )
      return result.toString('utf-8')
    } catch {
      return ''
    }
  }

  const sheets: ParsedSheet[] = []

  for (let si = 0; si < wb.SheetNames.length; si++) {
    const name = wb.SheetNames[si]
    const sheet = wb.Sheets[name]
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

    // Parse XML for hyperlinks
    const sheetXml = extractXmlFromZip(`xl/worksheets/sheet${si + 1}.xml`)
    const relsXml = extractXmlFromZip(`xl/worksheets/_rels/sheet${si + 1}.xml.rels`)

    const hyperlinks = new Map<string, string>()

    if (sheetXml && relsXml) {
      const relsMap = parseRelsXml(relsXml)
      const xmlHyperlinks = parseHyperlinksXml(sheetXml)

      for (const h of xmlHyperlinks) {
        const url = relsMap.get(h.rId)
        if (url) {
          hyperlinks.set(h.ref, url)
        }
      }
    }

    // Determine header row (first row with "Год" or "Номинал")
    let headerRow = 0
    for (let r = 0; r <= Math.min(range.e.r, 10); r++) {
      const firstCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })]
      const secondCell = sheet[XLSX.utils.encode_cell({ r, c: 1 })]
      if (!firstCell) continue
      // Standard layout: "Год" in col A, "Цена" in col B
      // Alt layout: "Номинал" in col A, "Год" in col B
      if (
        (firstCell.v === 'Год' && secondCell?.v === 'Цена') ||
        (firstCell.v === 'Номинал' && secondCell?.v === 'Год')
      ) {
        headerRow = r
        break
      }
    }

    // Parse header cells
    const headerCells: ParsedCell[] = []
    for (let c = 0; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: headerRow, c })
      const cell = sheet[addr]
      if (!cell) {
        headerCells.push({ value: null, type: 'empty' })
        continue
      }
      headerCells.push({
        value: cell.v,
        display: cell.w,
        type: cell.t || 'empty'
      })
    }

    // Parse data rows
    const rows: ParsedRow[] = []
    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const cells: ParsedCell[] = []
      const rowHyperlinks = new Map<string, string>()

      for (let c = 0; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = sheet[addr]
        if (!cell) {
          cells.push({ value: null, type: 'empty' })
          continue
        }

        cells.push({
          value: cell.v,
          display: cell.w,
          type: cell.t || 'empty'
        })

        // Check if this cell has a hyperlink
        if (hyperlinks.has(addr)) {
          rowHyperlinks.set(addr, hyperlinks.get(addr)!)
        }
      }

      // Skip completely empty rows (all cells null)
      const hasAnyData = cells.some(c => c.value !== null && c.value !== undefined && c.value !== '')
      if (!hasAnyData) continue

      if (options?.includeAllRows) {
        rows.push({ rowIndex: r, cells, hyperlinks: rowHyperlinks })
      } else {
        // Original behavior: only add rows that have at least a year value
        const yearCol = getYearColumn(sheet, headerRow)
        const yearCell = cells[yearCol]
        if (yearCell && (typeof yearCell.value === 'number' || yearCell.value)) {
          rows.push({ rowIndex: r, cells, hyperlinks: rowHyperlinks })
        }
      }
    }

    // Extract embedded images from drawing XML
    const images = extractSheetImages(filePath, si, headerRow)

    sheets.push({ name, headerCells, rows, hyperlinks, headerRow, images })
  }

  return { sheets }
}

function getYearColumn(sheet: XLSX.WorkSheet, headerRow: number): number {
  // Find which column has "Год" header
  for (let c = 0; c < 20; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c })
    const cell = sheet[addr]
    if (cell && cell.v === 'Год') return c
  }
  return 0 // default
}

// --- Column mapping detection ---

export interface ColumnMapping {
  year: number
  price: number
  shippingCost: number
  totalCost: number
  purchaseDate: number
  comments: number
  denomination: number // -1 if not present
  photoColumns: number[] // e.g. [6, 7] for columns G, H
}

export function detectColumns(sheet: ParsedSheet): ColumnMapping {
  const headerCells = sheet.headerCells
  if (!headerCells || headerCells.length === 0) {
    return {
      year: 0,
      price: 1,
      shippingCost: 2,
      totalCost: 3,
      purchaseDate: 4,
      comments: 5,
      denomination: -1,
      photoColumns: []
    }
  }

  const mapping: ColumnMapping = {
    year: -1,
    price: -1,
    shippingCost: -1,
    totalCost: -1,
    purchaseDate: -1,
    comments: -1,
    denomination: -1,
    photoColumns: []
  }

  for (let c = 0; c < headerCells.length; c++) {
    const val = String(headerCells[c].value ?? '')
    if (val === 'Год') mapping.year = c
    else if (val === 'Цена') mapping.price = c
    else if (val === 'Доставка') mapping.shippingCost = c
    else if (val === 'Общая стоимость') mapping.totalCost = c
    else if (val === 'Дата покупки') mapping.purchaseDate = c
    else if (val === 'Комментарии') mapping.comments = c
    else if (val === 'Номинал') mapping.denomination = c
  }

  // Detect photo columns: columns after comments that have hyperlinks in data rows
  if (mapping.comments >= 0) {
    for (let c = mapping.comments + 1; c < headerCells.length; c++) {
      // Check if any data row has a hyperlink in this column
      const hasLinks = sheet.rows.some((r) => {
        const cellRef = sheetIndexToRef(c) + (r.rowIndex + 1)
        return r.hyperlinks.has(cellRef)
      })
      if (hasLinks) {
        mapping.photoColumns.push(c)
      }
    }
  }

  return mapping
}

// --- Row parsing ---

export interface CoinData {
  year: number | null
  denomination: string
  price: number | null
  shippingCost: number | null
  purchaseDate: number | null // unix timestamp ms
  purchasePlace: string | null
  notes: string | null
  photoUrls: string[]
  embeddedImages: EmbeddedImage[]
}

export interface EmbeddedImage {
  rowIndex: number // 0-indexed row in the sheet (absolute, not data-relative)
  colIndex: number // 0-indexed column
  imagePath: string // e.g. "xl/media/image42.jpg"
}

export interface SheetImages {
  imageMap: Map<number, EmbeddedImage[]> // rowIndex → images at that row
  extractable: Array<{ row: number; col: number; path: string }> // flat list for iteration
}

const EXCEL_EPOCH = new Date(1900, 0, 1).getTime()

function excelDateToTimestamp(serial: number): number | null {
  // Excel dates: 1 = Jan 1 1900 (but with the 1900 leap year bug)
  if (!serial || serial < 1) return null
  // Excel's day 1 = 1899-12-30
  const msPerDay = 86400000
  const timestamp = (serial - 2) * msPerDay + EXCEL_EPOCH
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return null
  return date.getTime()
}

function parseNumericValue(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return val
  const str = String(val).trim()
  if (!str) return null
  // Remove spaces and non-breaking spaces used as thousand separators
  const cleaned = str.replace(/[\s\u00A0]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parseComments(raw: unknown): { purchasePlace: string | null; notes: string | null } {
  const str = String(raw ?? '').trim()
  if (!str) return { purchasePlace: null, notes: null }

  // Common patterns:
  // "meshok" → place: meshok
  // "ebay, GBP 9.95 + 4" → place: ebay, notes: GBP 9.95 + 4
  // "ebay, $30+$14" → place: ebay, notes: $30+$14
  // "GBP 15.00 + 2.85" → place: null, notes: GBP 15.00 + 2.85
  const commaIdx = str.indexOf(',')
  if (commaIdx >= 0) {
    const place = str.slice(0, commaIdx).trim()
    const notes = str.slice(commaIdx + 1).trim()
    return { purchasePlace: place || null, notes: notes || null }
  }
  return { purchasePlace: str, notes: null }
}

export function parseCoinRow(
  row: ParsedRow,
  mapping: ColumnMapping,
  _defaultCountryName: string,
  sheetImages: SheetImages | null = null
): CoinData {
  const getCell = (col: number): unknown => (col >= 0 ? row.cells[col]?.value : null)

  const year = parseNumericValue(getCell(mapping.year))
  const price = parseNumericValue(getCell(mapping.price))
  const shippingCost = parseNumericValue(getCell(mapping.shippingCost))
  const purchaseDateRaw = getCell(mapping.purchaseDate)
  const purchaseDate =
    typeof purchaseDateRaw === 'number' ? excelDateToTimestamp(purchaseDateRaw) : null
  const { purchasePlace, notes } = parseComments(getCell(mapping.comments))

  // Denomination
  let denomination = ''
  if (mapping.denomination >= 0) {
    denomination = String(getCell(mapping.denomination) ?? '').trim()
  }
  if (!denomination && year) {
    denomination = `${year} год`
  }

  // Photo URLs from hyperlinks
  const photoUrls: string[] = []
  for (const col of mapping.photoColumns) {
    const cellRef = sheetIndexToRef(col) + (row.rowIndex + 1)
    const url = row.hyperlinks.get(cellRef)
    if (url) {
      photoUrls.push(url)
    }
  }

  // Embedded images from xlsx drawing
  const embeddedImages: EmbeddedImage[] = sheetImages
    ? sheetImages.imageMap.get(row.rowIndex) ?? []
    : []

  return {
    year: year ? Math.round(year) : null,
    denomination,
    price,
    shippingCost,
    purchaseDate,
    purchasePlace,
    notes,
    photoUrls,
    embeddedImages
  }
}
