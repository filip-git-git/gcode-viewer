; Cabinet door hinge drilling pattern
; Demonstrates systematic hole placement for European-style hinges
; Workpiece: 600x400x18

; === Setup ===
G90          ; Absolute positioning
G21          ; Millimeters
T1 M6        ; 35mm Forstner bit for cup holes
S3000 M3     ; Spindle on CW (drilling speed)

; === Hinge 1 — Top Left (32mm from edge) ===
; Cup hole: 35mm diameter, 13mm deep
G0 X70 Y64 Z5       ; Rapid to hinge position
G1 Z-13 F300        ; Drill cup hole
G0 Z5               ; Retract

; === Hinge 2 — Top Right ===
G0 X530 Y64 Z5
G1 Z-13 F300
G0 Z5

; === Hinge 3 — Bottom Left ===
G0 X70 Y336 Z5
G1 Z-13 F300
G0 Z5

; === Hinge 4 — Bottom Right ===
G0 X530 Y336 Z5
G1 Z-13 F300
G0 Z5

; === Change to smaller bit for mounting screws ===
T2 M6        ; 3.5mm drill for screw pilot holes
S5000 M3

; === Screw holes for Hinge 1 ===
G0 X52 Y64 Z5
G1 Z-12 F400

G0 X52 Y78 Z5
G1 Z-12 F400

G0 X88 Y64 Z5
G1 Z-12 F400

G0 X88 Y78 Z5
G1 Z-12 F400

; === Screw holes for Hinge 2 ===
G0 X512 Y64 Z5
G1 Z-12 F400

G0 X512 Y78 Z5
G1 Z-12 F400

G0 X548 Y64 Z5
G1 Z-12 F400

G0 X548 Y78 Z5
G1 Z-12 F400

; === Screw holes for Hinge 3 ===
G0 X52 Y322 Z5
G1 Z-12 F400

G0 X52 Y336 Z5
G1 Z-12 F400

G0 X88 Y322 Z5
G1 Z-12 F400

G0 X88 Y336 Z5
G1 Z-12 F400

; === Screw holes for Hinge 4 ===
G0 X512 Y322 Z5
G1 Z-12 F400

G0 X512 Y336 Z5
G1 Z-12 F400

G0 X548 Y322 Z5
G1 Z-12 F400

G0 X548 Y336 Z5
G1 Z-12 F400

; === Handle mounting holes ===
T3 M6        ; 5mm drill for handle screws
S4500 M3

; Handle centered horizontally
G0 X300 Y30 Z5
G1 Z-15 F350

G0 X300 Y60 Z5
G1 Z-15 F350

; === Cleanup ===
G0 Z50
M5
M30
