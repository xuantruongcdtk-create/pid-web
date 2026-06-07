// @ts-ignore
import pdf from "pdf-parse";

export async function parsePdf(fileBuffer: Buffer): Promise<string> {
  try {
    const data = await pdf(fileBuffer);
    return data.text;
  } catch (error: any) {
    console.error("Error parsing PDF: ", error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}
