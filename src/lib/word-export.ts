import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
} from "docx";
import { saveAs } from "file-saver";

export type ResultRow = {
  id: string;
  user_id: string;
  score: number | null;
  violations: number;
  status: string;
  submitted_at: string | null;
  answers: unknown;
  rank: number | null;
  prize_awarded: number;
  is_winner: boolean;
  profile: { full_name: string | null; phone: string | null };
};

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function headerCell(text: string, width: number) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "2E75B6", type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })] })],
  });
}

function bodyCell(text: string, width: number, bold = false) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 18 })] })],
  });
}

function getStats(answers: unknown) {
  const raw = Array.isArray(answers) ? (answers as any[]) : [];
  const last = raw.length && typeof raw[raw.length - 1] === "object" && raw[raw.length - 1] !== null ? raw[raw.length - 1] : null;
  return {
    correct: Number(last?._correct ?? 0),
    wrong: Number(last?._wrong ?? 0),
    unanswered: Number(last?._unanswered ?? 0),
  };
}

export async function exportContestResultsToWord(
  contestTitle: string,
  prizePool: number,
  firstPrize: number,
  resultsStatus: string,
  rows: ResultRow[],
) {
  const colWidths = [600, 2400, 1600, 1000, 1000, 1000, 1000, 760];
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell("Rank", colWidths[0]),
      headerCell("Name", colWidths[1]),
      headerCell("Phone", colWidths[2]),
      headerCell("Score", colWidths[3]),
      headerCell("Correct", colWidths[4]),
      headerCell("Wrong", colWidths[5]),
      headerCell("Prize ₹", colWidths[6]),
      headerCell("Status", colWidths[7]),
    ],
  });

  const sorted = [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const bodyRows = sorted.map((r, i) => {
    const s = getStats(r.answers);
    return new TableRow({
      children: [
        bodyCell(r.rank ? String(r.rank) : String(i + 1), colWidths[0], true),
        bodyCell(r.profile.full_name || "Unknown", colWidths[1]),
        bodyCell(r.profile.phone || "—", colWidths[2]),
        bodyCell(String(r.score ?? 0), colWidths[3]),
        bodyCell(String(s.correct), colWidths[4]),
        bodyCell(String(s.wrong), colWidths[5]),
        bodyCell(r.prize_awarded ? String(r.prize_awarded) : "0", colWidths[6]),
        bodyCell(r.status, colWidths[7]),
      ],
    });
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "Cash Winning League", bold: true })],
        }),
        new Paragraph({
          children: [new TextRun({ text: contestTitle, bold: true, size: 28 })],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Prize Pool: ₹${prizePool}    |    1st Prize: ₹${firstPrize}    |    Status: ${resultsStatus}`, size: 18, color: "666666" }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 16, color: "999999" })],
          spacing: { after: 300 },
        }),
        new Table({
          width: { size: totalWidth, type: WidthType.DXA },
          columnWidths: colWidths,
          rows: [headerRow, ...bodyRows],
        }),
        new Paragraph({ spacing: { before: 400 } }),
        new Paragraph({
          children: [new TextRun({ text: `Total Participants: ${rows.length}`, bold: true, size: 18 })],
        }),
        new Paragraph({
          children: [new TextRun({ text: `Total Prize Distributed: ₹${rows.reduce((sum, r) => sum + (r.prize_awarded || 0), 0)}`, bold: true, size: 18 })],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const safeName = contestTitle.replace(/[^a-zA-Z0-9]+/g, "_").substring(0, 40);
  saveAs(buffer, `CWL_${safeName}_Results.docx`);
}
