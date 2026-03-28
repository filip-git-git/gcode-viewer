; Edge profiling and chamfering operations
; Demonstrates progressive material removal for edge finishing
; Workpiece: 500x300x18

; === Setup ===
G90          ; Absolute positioning
G21          ; Millimeters
T1 M6        ; 6mm flat end mill for pocketing
T2 M6        ; 45-degree chamfer bit
T3 M6        ; 3mm ball nose for detail work
S18000 M3

; === Operation 1: Panel face pocketing (lightening pockets) ===
G0 X50 Y50 Z5
G1 Z-3 F600
G1 X450 F2000
G1 Y250
G1 X50
G1 Y50

; Horizontal fill passes
G1 X50 Y65
G1 X450
G1 X450 Y80
G1 X50 Y80
G1 X50 Y95
G1 X450 Y95
G1 X450 Y110
G1 X50 Y110
G1 X50 Y125
G1 X450 Y125
G1 X450 Y140
G1 X50 Y140
G1 X50 Y155
G1 X450 Y155
G1 X450 Y170
G1 X50 Y170
G1 X50 Y185
G1 X450 Y185
G1 X450 Y200
G1 X50 Y200
G1 X50 Y215
G1 X450 Y215
G1 X450 Y230
G1 X50 Y230
G1 X50 Y245
G1 X450 Y245

; === Operation 2: Perimeter profiling ===
T2 M6        ; Chamfer bit
S20000 M3

; Front edge chamfer (0.5mm)
G0 X5 Y0 Z5
G1 Z-0.5 F400
G1 X495 Z-0.5 F3000
G1 Z5

; Back edge chamfer
G0 X5 Y300 Z5
G1 Z-0.5 F400
G1 X495 Z-0.5 F3000
G1 Z5

; Left edge chamfer
G0 X0 Y5 Z5
G1 Z-0.5 F400
G1 Y295 Z-0.5 F3000
G1 Z5

; Right edge chamfer
G0 X500 Y5 Z5
G1 Z-0.5 F400
G1 Y295 Z-0.5 F3000
G1 Z5

; === Operation 3: Corner rounding (top-left) ===
T3 M6        ; Ball nose
S22000 M3

G0 X10 Y290 Z5
G1 Z-9 F500
; Vertical pass
G1 Y270 F1500
; Horizontal pass
G1 X30 Y250
G1 Z5
G0 X10 Y250
G1 Z-9 F500
G1 X30 Y270
G1 Z5

; === Operation 4: Decorative groove pattern ===
T1 M6        ; Flat end mill
S18000 M3

; Horizontal decorative lines on face
G0 X80 Y100 Z5
G1 Z-2 F600
G1 X420 F2000
G1 Z5

G0 X80 Y150 Z5
G1 Z-2 F600
G1 X420 F2000
G1 Z5

G0 X80 Y200 Z5
G1 Z-2 F600
G1 X420 F2000
G1 Z5

; Vertical accent lines
G0 X150 Y100 Z5
G1 Z-2 F600
G1 Y200 F2000
G1 Z5

G0 X350 Y100 Z5
G1 Z-2 F600
G1 Y200 F2000
G1 Z5

; === Operation 5: Through holes for confirmation ===
T4 M6        ; 8mm through-hole bit
S3500 M3

G0 X50 Y50 Z5
G1 Z-18 F400

G0 X450 Y50 Z5
G1 Z-18 F400

G0 X50 Y250 Z5
G1 Z-18 F400

G0 X450 Y250 Z5
G1 Z-18 F400

G0 X250 Y150 Z5
G1 Z-18 F400

; === Operation 6: Ventilation slots (bottom of cabinet) ===
T1 M6
S18000 M3

; Row of slots
G0 X100 Y290 Z5
G1 Z-5 F600
G1 X140 Y290 F800
G1 Z5

G0 X160 Y290 Z5
G1 Z-5 F600
G1 X200 Y290 F800
G1 Z5

G0 X220 Y290 Z5
G1 Z-5 F600
G1 X260 Y290 F800
G1 Z5

G0 X280 Y290 Z5
G1 Z-5 F600
G1 X320 Y290 F800
G1 Z5

G0 X340 Y290 Z5
G1 Z-5 F600
G1 X380 Y290 F800
G1 Z5

; === Operation 7: Final edge cleanup pass ===
T2 M6
S22000 M3

; Full perimeter chamfer cleanup
G0 X0 Y0 Z5
G1 Z-1.5 F400
G1 X500 Y0 F2500
G1 X500 Y300
G1 X0 Y300
G1 X0 Y0
G1 Z5

; === Cleanup ===
G0 Z50
M5
M30
