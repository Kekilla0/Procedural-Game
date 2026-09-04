// Greedy word-wrap for canvas text — no native wrapping exists for fillText.
// Shared by anything that needs a paragraph inside a fixed-width area (class
// cards, the Character panel's class blurb, etc.). Caller sets ctx.font/
// fillStyle/textAlign before calling; only textAlign is overridden here
// (both supported alignments need it set per-line, since fillText doesn't
// wrap on its own). Returns the y position just past the last line drawn, so
// callers can keep flowing content after it.
export function wrapText(ctx, text, x, startY, maxWidth, lineHeight, align = 'left') {
    const words = text.split(' ');
    let line = '';
    let y = startY;
    ctx.textAlign = align;

    for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(testLine).width > maxWidth) {
            ctx.fillText(line, x, y);
            line = word;
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    if (line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
    }
    return y;
}
