// js/file_parser.js

export async function parseFile(file) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.pdf')) {
        return await parsePdf(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        return await parseExcel(file);
    } else {
        throw new Error("Unsupported file format. Please use PDF or Excel.");
    }
}

async function parsePdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let extractedText = "";
    let extractedImages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Text Extraction
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += `[Page ${i}]\n${pageText}\n\n`;

        // Image Extraction (First 5 pages only, similar to original logic)
        if (i <= 5) {
            try {
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                // Resize if needed to max 800px width
                const MAX_WIDTH = 800;
                let finalDataUrl;

                if (canvas.width > MAX_WIDTH) {
                    const scale = MAX_WIDTH / canvas.width;
                    const w = MAX_WIDTH;
                    const h = canvas.height * scale;
                    const c2 = document.createElement('canvas');
                    c2.width = w; c2.height = h;
                    c2.getContext('2d').drawImage(canvas, 0, 0, w, h);
                    finalDataUrl = c2.toDataURL('image/jpeg', 0.6);
                } else {
                    finalDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                }
                extractedImages.push(finalDataUrl);
            } catch (err) {
                console.warn(`Failed to render page ${i} image`, err);
            }
        }
    }

    return { text: extractedText, images: extractedImages, pageCount: pdf.numPages };
}

async function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                let extractedText = `[Excel File: ${file.name}]\n`;

                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const txt = XLSX.utils.sheet_to_txt(worksheet);
                    if(txt && txt.trim().length > 0) {
                        extractedText += `\n--- Sheet: ${sheetName} ---\n${txt}\n`;
                    }
                });

                resolve({ text: extractedText, images: [] });
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}
