function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
    const clamp = (c) => Math.round(Math.min(255, Math.max(0, c)));
    return '#' + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('');
}

// Weighted RGB blend of two hex colors — `weightA` is hexA's share (0-1),
// hexB gets the rest. Used for subclass colors (a weighted mix of the core
// class's color and the secondary attribute's color, matching the same
// primary:secondary ratio as the Attack formula itself), and anything else
// that wants a color derived from two others rather than a hardcoded one.
export function mixColors(hexA, hexB, weightA) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const weightB = 1 - weightA;
    return rgbToHex({
        r: a.r * weightA + b.r * weightB,
        g: a.g * weightA + b.g * weightB,
        b: a.b * weightA + b.b * weightB,
    });
}
