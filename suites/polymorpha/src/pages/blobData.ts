/** Connection lines between blobs */
export const CONNECTION_LINES = [
  { x1: 480, y1: 290, x2: 250, y2: 370, opacity: 0.07 },
  { x1: 480, y1: 290, x2: 720, y2: 240, opacity: 0.06 },
  { x1: 250, y1: 370, x2: 140, y2: 165, opacity: 0.05 },
  { x1: 720, y1: 240, x2: 850, y2: 200, opacity: 0.05 },
  { x1: 480, y1: 290, x2: 600, y2: 520, opacity: 0.05 },
  { x1: 250, y1: 370, x2: 350, y2: 560, opacity: 0.05 },
  { x1: 720, y1: 240, x2: 870, y2: 500, opacity: 0.04 },
  { x1: 600, y1: 520, x2: 350, y2: 560, opacity: 0.04 },
  { x1: 600, y1: 520, x2: 740, y2: 640, opacity: 0.04 },
  { x1: 350, y1: 560, x2: 210, y2: 660, opacity: 0.04 },
  { x1: 140, y1: 165, x2: 390, y2: 135, opacity: 0.04 },
  { x1: 850, y1: 200, x2: 870, y2: 500, opacity: 0.04 },
  { x1: 480, y1: 290, x2: 350, y2: 560, opacity: 0.04 },
  { x1: 100, y1: 500, x2: 250, y2: 370, opacity: 0.04 },
  { x1: 470, y1: 710, x2: 600, y2: 520, opacity: 0.03 },
] as const;

interface BlobEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  opacity: number;
}
interface BlobSparkle {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}
interface BlobLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}

export interface BlobShape {
  className: string;
  fill: string;
  opacity: number;
  filter?: string;
  strokeWidth: number;
  strokeOpacity: number;
  morphValues: string; // semicolon-separated path d values
  morphDuration: number;
  morphBegin?: string;
  keyTimes?: string;
  keySplines?: string;
  colorShiftFill?: string;
  colorShiftOpacity?: string;
  shiftDuration?: number;
  shiftBegin?: string;
  lineWidth?: number;
  lineDash?: string;
  ellipses: BlobEllipse[];
  sparkles: BlobSparkle[];
  lines: BlobLine[];
}

export interface TinyBlob {
  className: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  opacity: number;
  cxValues: string;
  cyValues: string;
  animDuration: number;
  animDuration2: number;
  sparkCx: number;
  sparkCy: number;
  sparkR: number;
  sparkOpacity: number;
}

/** Primary morphing blobs */
export const PRIMARY_BLOBS: BlobShape[] = [
  // Blob 1 — LARGE ~140px
  {
    className: "about-blob-orb about-blob-orb-1",
    fill: "url(#bh1)",
    opacity: 0.7,
    filter: "url(#bhGlow)",
    strokeWidth: 1.2,
    strokeOpacity: 0.25,
    morphValues:
      "M430 230 C480 205 545 215 570 260 C595 305 580 365 540 388 C500 411 448 402 425 368 C402 334 380 255 430 230Z;M420 222 C478 195 555 225 575 272 C595 319 562 378 518 395 C474 412 428 392 412 355 C396 318 362 249 420 222Z;M438 228 C492 208 558 240 555 290 C552 340 520 382 475 392 C430 402 395 365 392 320 C389 275 384 248 438 228Z;M425 225 C482 200 552 222 572 268 C592 314 558 372 510 390 C462 408 415 392 398 352 C381 312 368 250 425 225Z;M430 230 C480 205 545 215 570 260 C595 305 580 365 540 388 C500 411 448 402 425 368 C402 334 380 255 430 230Z",
    morphDuration: 24,
    keyTimes: "0;0.25;0.5;0.75;1",
    keySplines: "0.3 0 0.7 1;0.3 0 0.7 1;0.3 0 0.7 1;0.3 0 0.7 1",
    lineWidth: 0.7,
    lineDash: "3 3",
    ellipses: [
      { cx: 490, cy: 310, rx: 45, ry: 40, opacity: 0.12 },
      { cx: 460, cy: 268, rx: 28, ry: 18, opacity: 0.4 },
      { cx: 510, cy: 315, rx: 14, ry: 10, opacity: 0.22 },
    ],
    sparkles: [
      { cx: 450, cy: 272, r: 4, opacity: 0.95 },
      { cx: 498, cy: 260, r: 3, opacity: 0.9 },
      { cx: 525, cy: 310, r: 3.2, opacity: 0.85 },
      { cx: 470, cy: 345, r: 2.5, opacity: 0.8 },
      { cx: 490, cy: 295, r: 4.5, opacity: 0.95 },
    ],
    lines: [
      { x1: 450, y1: 272, x2: 498, y2: 260, opacity: 0.4 },
      { x1: 498, y1: 260, x2: 525, y2: 310, opacity: 0.35 },
      { x1: 490, y1: 295, x2: 470, y2: 345, opacity: 0.4 },
      { x1: 490, y1: 295, x2: 450, y2: 272, opacity: 0.35 },
    ],
  },
  // Blob 2 — MEDIUM ~75px, tall (heart morph)
  {
    className: "about-blob-orb about-blob-orb-2",
    fill: "url(#bh2)",
    opacity: 0.65,
    filter: "url(#bhGlow)",
    strokeWidth: 1,
    strokeOpacity: 0.2,
    morphValues:
      "M235 330 C252 310 268 315 272 340 C276 365 270 398 256 412 C242 426 222 420 218 395 C214 370 218 350 235 330Z;M233 328 C250 308 270 316 272 342 C274 372 266 402 252 416 C238 428 220 420 216 396 C212 368 216 348 233 328Z;M244 340 C260 318 278 326 272 350 C268 380 258 402 244 412 C230 402 220 380 216 350 C210 326 228 318 244 340Z;M244 345 C258 320 278 328 274 355 C270 382 252 408 244 414 C236 408 218 382 214 355 C210 328 230 320 244 345Z;M244 340 C260 318 278 326 272 350 C268 380 258 402 244 412 C230 402 220 380 216 350 C210 326 228 318 244 340Z;M233 328 C250 308 270 316 272 342 C274 372 266 402 252 416 C238 428 220 420 216 396 C212 368 216 348 233 328Z;M235 330 C252 310 268 315 272 340 C276 365 270 398 256 412 C242 426 222 420 218 395 C214 370 218 350 235 330Z",
    morphDuration: 40,
    morphBegin: "-20s",
    colorShiftFill: "#6366f1;#ec4899;#f472b6;#ec4899;#6366f1",
    colorShiftOpacity: "0;0.35;0.5;0.35;0",
    shiftDuration: 50,
    shiftBegin: "-25s",
    lineWidth: 0.6,
    lineDash: "2 2",
    ellipses: [
      { cx: 244, cy: 370, rx: 18, ry: 25, opacity: 0.1 },
      { cx: 238, cy: 350, rx: 12, ry: 9, opacity: 0.4 },
      { cx: 250, cy: 385, rx: 8, ry: 6, opacity: 0.2 },
    ],
    sparkles: [
      { cx: 235, cy: 352, r: 3, opacity: 0.95 },
      { cx: 252, cy: 342, r: 2.2, opacity: 0.9 },
      { cx: 248, cy: 388, r: 2.5, opacity: 0.85 },
      { cx: 238, cy: 372, r: 3.2, opacity: 0.95 },
    ],
    lines: [
      { x1: 235, y1: 352, x2: 252, y2: 342, opacity: 0.4 },
      { x1: 238, y1: 372, x2: 248, y2: 388, opacity: 0.35 },
      { x1: 238, y1: 372, x2: 235, y2: 352, opacity: 0.35 },
    ],
  },
  // Blob 3 — LARGE-MEDIUM ~110px (cloud morph)
  {
    className: "about-blob-orb about-blob-orb-3",
    fill: "url(#bh3)",
    opacity: 0.65,
    filter: "url(#bhGlow)",
    strokeWidth: 1.1,
    strokeOpacity: 0.22,
    morphValues:
      "M670 210 C718 200 760 218 768 248 C776 278 752 302 715 308 C678 314 640 298 635 268 C630 238 622 220 670 210Z;M668 208 C716 198 758 216 764 246 C770 276 748 300 712 306 C676 312 642 296 638 266 C634 236 620 218 668 208Z;M655 220 C700 208 750 215 755 245 C758 278 740 300 705 305 C668 310 640 295 640 265 C640 235 618 230 655 220Z;M650 225 C695 215 748 218 752 248 C756 280 735 302 698 308 C660 314 632 298 635 265 C638 232 610 235 650 225Z;M655 220 C700 208 750 215 755 245 C758 278 740 300 705 305 C668 310 640 295 640 265 C640 235 618 230 655 220Z;M668 208 C716 198 758 216 764 246 C770 276 748 300 712 306 C676 312 642 296 638 266 C634 236 620 218 668 208Z;M670 210 C718 200 760 218 768 248 C776 278 752 302 715 308 C678 314 640 298 635 268 C630 238 622 220 670 210Z",
    morphDuration: 45,
    morphBegin: "-23s",
    colorShiftFill: "#a78bfa;#06b6d4;#22d3ee;#06b6d4;#a78bfa",
    colorShiftOpacity: "0;0.3;0.45;0.3;0",
    shiftDuration: 55,
    shiftBegin: "-28s",
    lineWidth: 0.7,
    lineDash: "3 3",
    ellipses: [
      { cx: 695, cy: 258, rx: 38, ry: 28, opacity: 0.1 },
      { cx: 680, cy: 238, rx: 20, ry: 12, opacity: 0.4 },
      { cx: 712, cy: 268, rx: 12, ry: 8, opacity: 0.22 },
    ],
    sparkles: [
      { cx: 675, cy: 240, r: 3.5, opacity: 0.95 },
      { cx: 710, cy: 235, r: 2.8, opacity: 0.9 },
      { cx: 720, cy: 270, r: 3, opacity: 0.85 },
      { cx: 680, cy: 275, r: 2.2, opacity: 0.8 },
      { cx: 695, cy: 255, r: 4, opacity: 0.95 },
    ],
    lines: [
      { x1: 675, y1: 240, x2: 710, y2: 235, opacity: 0.4 },
      { x1: 710, y1: 235, x2: 720, y2: 270, opacity: 0.35 },
      { x1: 695, y1: 255, x2: 680, y2: 275, opacity: 0.4 },
      { x1: 695, y1: 255, x2: 675, y2: 240, opacity: 0.35 },
    ],
  },
  // Blob 4 — SMALL ~50px (star morph)
  {
    className: "about-blob-orb about-blob-orb-4",
    fill: "url(#bh1)",
    opacity: 0.6,
    filter: "url(#bhGlow)",
    strokeWidth: 0.8,
    strokeOpacity: 0.2,
    morphValues:
      "M588 500 C604 492 618 498 620 512 C622 526 612 538 598 539 C584 540 572 530 572 516 C572 502 572 508 588 500Z;M586 498 C602 490 618 497 620 512 C622 527 612 538 598 538 C584 538 572 528 572 514 C572 500 570 506 586 498Z;M596 492 C604 500 614 506 612 516 C610 528 604 534 596 540 C588 534 582 528 580 516 C578 506 588 500 596 492Z;M596 490 C606 500 616 508 612 518 C608 530 604 536 596 542 C588 536 584 530 580 518 C576 508 586 500 596 490Z;M596 492 C604 500 614 506 612 516 C610 528 604 534 596 540 C588 534 582 528 580 516 C578 506 588 500 596 492Z;M586 498 C602 490 618 497 620 512 C622 527 612 538 598 538 C584 538 572 528 572 514 C572 500 570 506 586 498Z;M588 500 C604 492 618 498 620 512 C622 526 612 538 598 539 C584 540 572 530 572 516 C572 502 572 508 588 500Z",
    morphDuration: 35,
    morphBegin: "-18s",
    colorShiftFill: "#3b82f6;#f59e0b;#fbbf24;#f59e0b;#3b82f6",
    colorShiftOpacity: "0;0.3;0.45;0.3;0",
    shiftDuration: 50,
    shiftBegin: "-25s",
    lineWidth: 0.5,
    lineDash: "2 2",
    ellipses: [
      { cx: 596, cy: 518, rx: 14, ry: 12, opacity: 0.1 },
      { cx: 588, cy: 508, rx: 8, ry: 6, opacity: 0.4 },
    ],
    sparkles: [
      { cx: 586, cy: 510, r: 2.5, opacity: 0.95 },
      { cx: 600, cy: 505, r: 2, opacity: 0.9 },
      { cx: 598, cy: 524, r: 2, opacity: 0.85 },
    ],
    lines: [
      { x1: 586, y1: 510, x2: 600, y2: 505, opacity: 0.4 },
      { x1: 600, y1: 505, x2: 598, y2: 524, opacity: 0.35 },
    ],
  },
  // Blob 5 — MEDIUM ~80px (teardrop morph)
  {
    className: "about-blob-orb about-blob-orb-5",
    fill: "url(#bh2)",
    opacity: 0.6,
    filter: "url(#bhGlow)",
    strokeWidth: 0.9,
    strokeOpacity: 0.2,
    morphValues:
      "M325 530 C350 515 378 522 385 545 C392 568 375 595 352 600 C329 605 305 590 302 568 C299 546 300 545 325 530Z;M323 528 C348 514 376 520 382 544 C388 568 372 594 350 598 C328 602 306 588 304 566 C302 544 298 542 323 528Z;M345 525 C360 530 372 545 370 568 C368 590 355 602 345 605 C335 602 322 590 320 568 C318 545 330 530 345 525Z;M345 522 C362 528 375 545 372 570 C369 594 356 606 345 608 C334 606 321 594 318 570 C315 545 328 528 345 522Z;M345 525 C360 530 372 545 370 568 C368 590 355 602 345 605 C335 602 322 590 320 568 C318 545 330 530 345 525Z;M323 528 C348 514 376 520 382 544 C388 568 372 594 350 598 C328 602 306 588 304 566 C302 544 298 542 323 528Z;M325 530 C350 515 378 522 385 545 C392 568 375 595 352 600 C329 605 305 590 302 568 C299 546 300 545 325 530Z",
    morphDuration: 42,
    morphBegin: "-21s",
    colorShiftFill: "#6366f1;#10b981;#34d399;#10b981;#6366f1",
    colorShiftOpacity: "0;0.3;0.45;0.3;0",
    shiftDuration: 55,
    shiftBegin: "-28s",
    lineWidth: 0.6,
    lineDash: "2.5 2.5",
    ellipses: [
      { cx: 345, cy: 565, rx: 22, ry: 20, opacity: 0.1 },
      { cx: 335, cy: 550, rx: 14, ry: 10, opacity: 0.38 },
      { cx: 352, cy: 575, rx: 8, ry: 6, opacity: 0.2 },
    ],
    sparkles: [
      { cx: 330, cy: 552, r: 3, opacity: 0.95 },
      { cx: 355, cy: 545, r: 2.5, opacity: 0.9 },
      { cx: 358, cy: 578, r: 2.5, opacity: 0.85 },
      { cx: 335, cy: 582, r: 2, opacity: 0.8 },
      { cx: 345, cy: 565, r: 3.5, opacity: 0.95 },
    ],
    lines: [
      { x1: 330, y1: 552, x2: 355, y2: 545, opacity: 0.4 },
      { x1: 355, y1: 545, x2: 358, y2: 578, opacity: 0.35 },
      { x1: 345, y1: 565, x2: 335, y2: 582, opacity: 0.4 },
      { x1: 345, y1: 565, x2: 330, y2: 552, opacity: 0.35 },
    ],
  },
];

export const SECONDARY_BLOBS: BlobShape[] = [
  {
    className: "about-blob-secondary about-blob-drift-1",
    fill: "url(#bh2)",
    opacity: 0.45,
    filter: "url(#bhGlow)",
    strokeWidth: 0.9,
    strokeOpacity: 0.2,
    morphValues:
      "M105 120 C135 105 168 115 175 145 C182 175 162 205 135 210 C108 215 82 198 80 170 C78 142 75 135 105 120Z;M100 115 C132 98 172 112 178 145 C184 178 158 212 128 214 C98 216 74 195 76 165 C78 135 68 132 100 115Z;M110 122 C140 110 170 128 166 158 C162 188 142 210 115 208 C88 206 72 182 78 155 C84 128 80 138 110 122Z;M103 118 C136 102 170 118 174 150 C178 182 155 210 125 210 C95 210 74 188 78 158 C82 128 70 134 103 118Z;M105 120 C135 105 168 115 175 145 C182 175 162 205 135 210 C108 215 82 198 80 170 C78 142 75 135 105 120Z",
    morphDuration: 28,
    ellipses: [
      { cx: 120, cy: 160, rx: 28, ry: 22, opacity: 0.08 },
      { cx: 112, cy: 145, rx: 15, ry: 10, opacity: 0.35 },
      { cx: 132, cy: 172, rx: 8, ry: 6, opacity: 0.18 },
    ],
    sparkles: [
      { cx: 110, cy: 147, r: 3, opacity: 0.95 },
      { cx: 132, cy: 140, r: 2.2, opacity: 0.9 },
      { cx: 138, cy: 172, r: 2.5, opacity: 0.85 },
      { cx: 115, cy: 178, r: 2, opacity: 0.8 },
    ],
    lines: [
      { x1: 110, y1: 147, x2: 132, y2: 140, opacity: 0.4 },
      { x1: 132, y1: 140, x2: 138, y2: 172, opacity: 0.35 },
      { x1: 110, y1: 147, x2: 115, y2: 178, opacity: 0.35 },
    ],
  },
  {
    className: "about-blob-secondary about-blob-drift-2",
    fill: "url(#bh3)",
    opacity: 0.42,
    strokeWidth: 0.7,
    strokeOpacity: 0.18,
    morphValues:
      "M830 165 C850 155 868 162 870 180 C872 198 858 212 840 210 C822 208 810 196 812 178 C814 160 810 175 830 165Z;M825 160 C848 148 870 160 872 180 C874 200 855 216 836 212 C817 208 806 192 810 174 C814 156 804 170 825 160Z;M835 168 C852 160 870 172 866 190 C862 208 848 215 832 212 C816 209 806 194 812 176 C818 158 818 178 835 168Z;M828 163 C850 152 870 165 870 184 C870 203 852 216 835 212 C818 208 808 192 812 175 C816 158 808 173 828 163Z;M830 165 C850 155 868 162 870 180 C872 198 858 212 840 210 C822 208 810 196 812 178 C814 160 810 175 830 165Z",
    morphDuration: 32,
    ellipses: [
      { cx: 838, cy: 183, rx: 16, ry: 14, opacity: 0.08 },
      { cx: 832, cy: 176, rx: 9, ry: 6, opacity: 0.32 },
    ],
    sparkles: [
      { cx: 830, cy: 178, r: 2.5, opacity: 0.95 },
      { cx: 845, cy: 172, r: 2, opacity: 0.9 },
      { cx: 842, cy: 195, r: 2, opacity: 0.8 },
    ],
    lines: [
      { x1: 830, y1: 178, x2: 845, y2: 172, opacity: 0.4 },
      { x1: 845, y1: 172, x2: 842, y2: 195, opacity: 0.35 },
    ],
  },
  {
    className: "about-blob-secondary about-blob-drift-3",
    fill: "url(#bh1)",
    opacity: 0.4,
    strokeWidth: 0.5,
    strokeOpacity: 0.15,
    morphValues:
      "M80 490 C92 484 104 488 106 500 C108 512 98 520 88 519 C78 518 70 510 72 498 C74 486 68 496 80 490Z;M76 486 C90 478 106 486 108 500 C110 514 96 524 84 522 C72 520 64 508 68 496 C72 484 62 494 76 486Z;M84 492 C94 488 106 496 102 508 C98 520 90 522 80 520 C70 518 64 506 70 496 C76 486 72 500 84 492Z;M78 488 C92 480 106 490 106 502 C106 514 94 524 82 522 C70 520 64 508 68 496 C72 484 66 496 78 488Z;M80 490 C92 484 104 488 106 500 C108 512 98 520 88 519 C78 518 70 510 72 498 C74 486 68 496 80 490Z",
    morphDuration: 36,
    ellipses: [],
    sparkles: [
      { cx: 86, cy: 500, r: 2, opacity: 0.9 },
      { cx: 92, cy: 508, r: 1.3, opacity: 0.75 },
    ],
    lines: [{ x1: 86, y1: 500, x2: 92, y2: 508, opacity: 0.35 }],
  },
  {
    className: "about-blob-secondary about-blob-drift-4",
    fill: "url(#bh3)",
    opacity: 0.42,
    filter: "url(#bhGlow)",
    strokeWidth: 0.7,
    strokeOpacity: 0.18,
    morphValues:
      "M870 470 C890 460 908 468 910 486 C912 504 898 516 880 515 C862 514 850 502 852 484 C854 466 848 478 870 470Z;M865 466 C888 454 910 466 912 486 C914 506 896 520 878 518 C860 516 848 500 852 482 C856 464 844 476 865 466Z;M875 472 C892 464 910 476 906 494 C902 512 890 518 872 516 C854 514 846 498 852 482 C858 466 852 484 875 472Z;M868 468 C890 458 910 470 910 490 C910 510 894 520 876 518 C858 516 848 500 852 482 C856 464 846 478 868 468Z;M870 470 C890 460 908 468 910 486 C912 504 898 516 880 515 C862 514 850 502 852 484 C854 466 848 478 870 470Z",
    morphDuration: 30,
    ellipses: [
      { cx: 880, cy: 490, rx: 16, ry: 13, opacity: 0.08 },
      { cx: 874, cy: 482, rx: 9, ry: 6, opacity: 0.3 },
    ],
    sparkles: [
      { cx: 872, cy: 484, r: 2.5, opacity: 0.95 },
      { cx: 886, cy: 480, r: 2, opacity: 0.9 },
      { cx: 884, cy: 502, r: 2, opacity: 0.8 },
    ],
    lines: [
      { x1: 872, y1: 484, x2: 886, y2: 480, opacity: 0.4 },
      { x1: 886, y1: 480, x2: 884, y2: 502, opacity: 0.35 },
    ],
  },
  {
    className: "about-blob-secondary about-blob-drift-5",
    fill: "url(#bh1)",
    opacity: 0.38,
    strokeWidth: 0.6,
    strokeOpacity: 0.15,
    morphValues:
      "M195 650 C210 642 225 648 226 662 C227 676 216 685 204 684 C192 683 182 674 184 660 C186 646 182 656 195 650Z;M190 646 C208 636 228 646 228 662 C228 678 214 688 200 686 C186 684 176 670 180 656 C184 642 174 654 190 646Z;M200 652 C212 646 226 656 222 668 C218 680 210 686 198 684 C186 682 178 670 184 658 C190 646 186 660 200 652Z;M193 648 C210 640 226 650 226 664 C226 678 214 688 200 686 C186 684 178 672 182 658 C186 644 180 656 193 648Z;M195 650 C210 642 225 648 226 662 C227 676 216 685 204 684 C192 683 182 674 184 660 C186 646 182 656 195 650Z",
    morphDuration: 34,
    ellipses: [],
    sparkles: [
      { cx: 200, cy: 660, r: 2, opacity: 0.95 },
      { cx: 210, cy: 668, r: 1.5, opacity: 0.8 },
    ],
    lines: [{ x1: 200, y1: 660, x2: 210, y2: 668, opacity: 0.35 }],
  },
  {
    className: "about-blob-secondary about-blob-drift-6",
    fill: "url(#bh2)",
    opacity: 0.4,
    filter: "url(#bhGlow)",
    strokeWidth: 0.9,
    strokeOpacity: 0.2,
    morphValues:
      "M710 600 C740 588 768 598 772 625 C776 652 754 678 728 680 C702 682 680 662 682 635 C684 608 680 618 710 600Z;M705 595 C738 580 772 595 774 625 C776 655 750 682 722 682 C694 682 672 658 676 628 C680 598 670 612 705 595Z;M715 602 C742 592 768 610 764 638 C760 666 740 682 715 680 C690 678 672 654 678 628 C684 602 678 618 715 602Z;M708 598 C740 585 770 600 772 630 C774 660 748 682 720 680 C692 678 674 656 678 628 C682 600 674 614 708 598Z;M710 600 C740 588 768 598 772 625 C776 652 754 678 728 680 C702 682 680 662 682 635 C684 608 680 618 710 600Z",
    morphDuration: 26,
    ellipses: [
      { cx: 725, cy: 638, rx: 24, ry: 20, opacity: 0.08 },
      { cx: 716, cy: 622, rx: 14, ry: 9, opacity: 0.35 },
      { cx: 735, cy: 648, rx: 8, ry: 6, opacity: 0.18 },
    ],
    sparkles: [
      { cx: 714, cy: 624, r: 3, opacity: 0.95 },
      { cx: 736, cy: 620, r: 2.2, opacity: 0.9 },
      { cx: 740, cy: 648, r: 2.5, opacity: 0.85 },
      { cx: 718, cy: 655, r: 2, opacity: 0.8 },
    ],
    lines: [
      { x1: 714, y1: 624, x2: 736, y2: 620, opacity: 0.4 },
      { x1: 736, y1: 620, x2: 740, y2: 648, opacity: 0.35 },
      { x1: 714, y1: 624, x2: 718, y2: 655, opacity: 0.35 },
    ],
  },
  {
    className: "about-blob-secondary about-blob-drift-7",
    fill: "url(#bh3)",
    opacity: 0.36,
    strokeWidth: 0.6,
    strokeOpacity: 0.15,
    morphValues:
      "M455 690 C472 682 490 688 492 704 C494 720 480 730 466 728 C452 726 442 716 444 700 C446 684 440 696 455 690Z;M450 686 C470 676 492 686 494 704 C496 722 478 734 462 730 C446 726 436 712 440 696 C444 680 434 692 450 686Z;M460 692 C476 686 492 696 488 712 C484 728 472 732 458 730 C444 728 436 714 442 698 C448 682 444 700 460 692Z;M453 688 C472 680 492 690 492 708 C492 726 476 734 460 730 C444 726 436 712 440 696 C444 680 436 694 453 688Z;M455 690 C472 682 490 688 492 704 C494 720 480 730 466 728 C452 726 442 716 444 700 C446 684 440 696 455 690Z",
    morphDuration: 38,
    ellipses: [
      { cx: 465, cy: 708, rx: 13, ry: 11, opacity: 0.08 },
      { cx: 460, cy: 700, rx: 8, ry: 5, opacity: 0.3 },
    ],
    sparkles: [
      { cx: 458, cy: 702, r: 2, opacity: 0.95 },
      { cx: 472, cy: 698, r: 1.5, opacity: 0.85 },
      { cx: 468, cy: 715, r: 1.5, opacity: 0.75 },
    ],
    lines: [
      { x1: 458, y1: 702, x2: 472, y2: 698, opacity: 0.4 },
      { x1: 472, y1: 698, x2: 468, y2: 715, opacity: 0.35 },
    ],
  },
  {
    className: "about-blob-secondary about-blob-drift-8",
    fill: "url(#bh1)",
    opacity: 0.35,
    strokeWidth: 0.5,
    strokeOpacity: 0.15,
    lineWidth: 0.3,
    lineDash: "1 1",
    morphValues:
      "M385 105 C396 100 406 104 408 114 C410 124 402 132 394 131 C386 130 378 124 380 114 C382 104 376 112 385 105Z;M382 102 C394 96 408 102 408 114 C408 126 398 134 388 132 C378 130 372 120 376 110 C380 100 370 110 382 102Z;M388 106 C398 102 408 110 404 120 C400 130 394 132 386 130 C378 128 372 120 376 112 C380 104 376 116 388 106Z;M384 104 C396 98 408 106 408 116 C408 126 398 134 388 132 C378 130 372 122 376 112 C380 102 374 112 384 104Z;M385 105 C396 100 406 104 408 114 C410 124 402 132 394 131 C386 130 378 124 380 114 C382 104 376 112 385 105Z",
    morphDuration: 28,
    ellipses: [],
    sparkles: [
      { cx: 390, cy: 114, r: 1.5, opacity: 0.9 },
      { cx: 396, cy: 120, r: 1, opacity: 0.7 },
    ],
    lines: [{ x1: 390, y1: 114, x2: 396, y2: 120, opacity: 0.35 }],
  },
];

export const TINY_BLOBS: TinyBlob[] = [
  {
    className: "about-blob-tiny about-blob-drift-1",
    cx: 950,
    cy: 320,
    r: 10,
    fill: "url(#bh1)",
    opacity: 0.3,
    cxValues: "950;944;956;950",
    cyValues: "320;312;328;320",
    animDuration: 45,
    animDuration2: 52,
    sparkCx: 947,
    sparkCy: 317,
    sparkR: 1.5,
    sparkOpacity: 0.8,
  },
  {
    className: "about-blob-tiny about-blob-drift-3",
    cx: 50,
    cy: 550,
    r: 12,
    fill: "url(#bh2)",
    opacity: 0.28,
    cxValues: "50;56;44;50",
    cyValues: "550;558;542;550",
    animDuration: 48,
    animDuration2: 40,
    sparkCx: 47,
    sparkCy: 547,
    sparkR: 1.5,
    sparkOpacity: 0.75,
  },
  {
    className: "about-blob-tiny about-blob-drift-5",
    cx: 650,
    cy: 80,
    r: 11,
    fill: "url(#bh1)",
    opacity: 0.25,
    cxValues: "650;658;642;650",
    cyValues: "80;72;88;80",
    animDuration: 55,
    animDuration2: 46,
    sparkCx: 647,
    sparkCy: 77,
    sparkR: 1.5,
    sparkOpacity: 0.75,
  },
  {
    className: "about-blob-tiny about-blob-drift-7",
    cx: 300,
    cy: 60,
    r: 9,
    fill: "url(#bh2)",
    opacity: 0.22,
    cxValues: "300;306;294;300",
    cyValues: "60;54;66;60",
    animDuration: 50,
    animDuration2: 42,
    sparkCx: 297,
    sparkCy: 57,
    sparkR: 1.2,
    sparkOpacity: 0.7,
  },
  {
    className: "about-blob-tiny about-blob-drift-2",
    cx: 900,
    cy: 240,
    r: 10,
    fill: "url(#bh3)",
    opacity: 0.25,
    cxValues: "900;908;892;900",
    cyValues: "240;234;248;240",
    animDuration: 47,
    animDuration2: 54,
    sparkCx: 897,
    sparkCy: 237,
    sparkR: 1.5,
    sparkOpacity: 0.75,
  },
];
