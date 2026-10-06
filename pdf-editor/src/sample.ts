import { PDFDocument, PDFHexString, PDFName, PDFRef, StandardFonts, rgb } from "pdf-lib"

/** Build a small demo PDF with text, a fillable form and bookmarks. */
export async function makeSamplePdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create()
    doc.setTitle("PDF Studio — Sample document")
    doc.setAuthor("PDF Studio")
    doc.setSubject("A sample file for trying out the editor")
    const helv = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const accent = rgb(0.84, 0.2, 0.18)
    const ink = rgb(0.13, 0.14, 0.17)
    const grey = rgb(0.4, 0.42, 0.46)

    const para = (page: ReturnType<typeof doc.addPage>, text: string, y: number, size = 11, width = 468) => {
        const words = text.split(" ")
        let line = ""
        for (const w of words) {
            const next = line ? `${line} ${w}` : w
            if (helv.widthOfTextAtSize(next, size) > width) {
                page.drawText(line, { x: 72, y, size, font: helv, color: ink })
                y -= size * 1.5
                line = w
            } else line = next
        }
        if (line) page.drawText(line, { x: 72, y, size, font: helv, color: ink })
        return y - size * 2.2
    }

    // Page 1 — welcome
    const p1 = doc.addPage([612, 792])
    p1.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: accent })
    p1.drawText("PDF Studio", { x: 72, y: 760, size: 18, font: bold, color: rgb(1, 1, 1) })
    p1.drawText("Welcome to your PDF editor", { x: 72, y: 680, size: 26, font: bold, color: ink })
    let y = para(
        p1,
        "This sample document lets you try every tool. Select some of this text and use the Highlight, Underline or Strikethrough tools to mark it up, exactly like you would in a desktop PDF reader.",
        640,
    )
    y = para(
        p1,
        "Add sticky notes with comments, draw freehand with the pen, place shapes and arrows, type text anywhere on the page, cover content with whiteout, and sign documents with a drawn, typed or uploaded signature. Every change can be undone.",
        y,
    )
    y = para(
        p1,
        "When you're done, use Save to download a standard PDF. Your markup is written into the file so it shows up in Adobe Acrobat, Preview, Chrome and any other viewer. Sticky notes become real PDF comments.",
        y,
    )
    p1.drawText("Try searching for the word \"quantum\" with Ctrl+F.", { x: 72, y: y - 10, size: 11, font: bold, color: grey })
    p1.drawText("1", { x: 300, y: 40, size: 9, font: helv, color: grey })

    // Page 2 — form
    const p2 = doc.addPage([612, 792])
    p2.drawText("Fill in the form", { x: 72, y: 700, size: 22, font: bold, color: ink })
    para(p2, "Form fields in a PDF are interactive. Click a field to type — the values are saved into the file.", 670)
    const form = doc.getForm()
    const label = (t: string, yy: number) => p2.drawText(t, { x: 72, y: yy + 6, size: 11, font: bold, color: ink })
    label("Full name", 600)
    const name = form.createTextField("full_name")
    name.addToPage(p2, { x: 200, y: 594, width: 300, height: 24, font: helv })
    label("Email", 560)
    const email = form.createTextField("email")
    email.addToPage(p2, { x: 200, y: 554, width: 300, height: 24, font: helv })
    label("Department", 520)
    const dept = form.createDropdown("department")
    dept.addOptions(["Engineering", "Design", "Marketing", "Sales", "Operations"])
    dept.addToPage(p2, { x: 200, y: 514, width: 300, height: 24, font: helv })
    label("Subscribe", 480)
    const sub = form.createCheckBox("subscribe")
    sub.addToPage(p2, { x: 200, y: 478, width: 18, height: 18 })
    label("Comments", 440)
    const comments = form.createTextField("comments")
    comments.enableMultiline()
    comments.addToPage(p2, { x: 200, y: 360, width: 300, height: 90, font: helv })
    p2.drawLine({ start: { x: 72, y: 250 }, end: { x: 300, y: 250 }, thickness: 1, color: grey })
    p2.drawText("Signature", { x: 72, y: 236, size: 9, font: helv, color: grey })
    p2.drawLine({ start: { x: 340, y: 250 }, end: { x: 540, y: 250 }, thickness: 1, color: grey })
    p2.drawText("Date", { x: 340, y: 236, size: 9, font: helv, color: grey })
    p2.drawText("2", { x: 300, y: 40, size: 9, font: helv, color: grey })

    // Page 3 — long text
    const p3 = doc.addPage([612, 792])
    p3.drawText("Notes on reading", { x: 72, y: 700, size: 22, font: bold, color: ink })
    let y3 = 660
    const lorem = [
        "Reading on screen works best when the layout respects the reader. Zoom to fit the width of the window for comfortable line lengths, or fit the whole page when you need an overview.",
        "Search finds every occurrence across the document, including words like quantum that appear more than once. Use the arrows next to the search box to step through results.",
        "Use the Organize view to reorder pages by dragging, rotate or delete them, insert blank pages, merge in pages from another PDF, or extract a selection into a new file.",
        "Bookmarks on the left jump straight to a section. This sample includes a few so you can try them. A quantum of patience goes a long way with complex documents.",
    ]
    for (const t of lorem) y3 = para(p3, t, y3)
    p3.drawText("3", { x: 300, y: 40, size: 9, font: helv, color: grey })

    addOutline(doc, [
        ["Welcome", p1.ref, 792],
        ["Fill in the form", p2.ref, 740],
        ["Notes on reading", p3.ref, 740],
    ])

    return doc.save()
}

function addOutline(doc: PDFDocument, entries: [string, PDFRef, number][]) {
    const ctx = doc.context
    const outlinesRef = ctx.nextRef()
    const refs = entries.map(() => ctx.nextRef())
    entries.forEach(([title, pageRef, top], i) => {
        const item = ctx.obj({
            Title: PDFHexString.fromText(title),
            Parent: outlinesRef,
            Dest: [pageRef, "XYZ", null, top, null],
        })
        if (i > 0) item.set(PDFName.of("Prev"), refs[i - 1])
        if (i < refs.length - 1) item.set(PDFName.of("Next"), refs[i + 1])
        ctx.assign(refs[i], item)
    })
    ctx.assign(
        outlinesRef,
        ctx.obj({ Type: "Outlines", First: refs[0], Last: refs[refs.length - 1], Count: refs.length }),
    )
    doc.catalog.set(PDFName.of("Outlines"), outlinesRef)
}
