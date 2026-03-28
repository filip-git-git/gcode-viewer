; gcode-viewer demo — furniture panel with pockets and holes
; Workpiece: 400x300x18

; === Setup ===
G90          ; Absolute positioning
G21          ; Millimeters
T1 M6        ; 6mm flat end mill
S18000 M3    ; Spindle on CW

; === Rectangular pocket — center of panel ===
; Rough pass at Z-10
G0 X100 Y100 Z5       ; Rapid to start position
G1 Z-10 F800          ; Plunge to depth
G1 X300 Y100 F2000    ; Bottom edge
G1 X300 Y200          ; Right edge
G1 X100 Y200          ; Top edge
G1 X100 Y100          ; Close pocket outline

; Fill pocket interior — horizontal passes
G1 X100 Y110
G1 X300 Y110
G1 X300 Y120
G1 X100 Y120
G1 X100 Y130
G1 X300 Y130
G1 X300 Y140
G1 X100 Y140
G1 X100 Y150
G1 X300 Y150
G1 X300 Y160
G1 X100 Y160
G1 X100 Y170
G1 X300 Y170
G1 X300 Y180
G1 X100 Y180
G1 X100 Y190
G1 X300 Y190

; === Small pocket — top-left corner ===
G0 Z5                  ; Retract
G0 X20 Y230            ; Move to second pocket
G1 Z-8 F600            ; Shallow plunge
G1 X80 Y230 F1500      ; Bottom
G1 X80 Y270            ; Right
G1 X20 Y270            ; Top
G1 X20 Y230            ; Close

; Fill
G1 X20 Y240
G1 X80 Y240
G1 X80 Y250
G1 X20 Y250
G1 X20 Y260
G1 X80 Y260

; === Groove — diagonal line ===
G0 Z5
G0 X320 Y220
G1 Z-5 F500
G1 X380 Y280 F1200     ; Diagonal cut

; === Through-hole pattern (drill simulation with end mill) ===
; Hole 1
G0 Z5
G0 X50 Y50
G1 Z-18 F400           ; Through the panel

; Hole 2
G0 Z5
G0 X350 Y50
G1 Z-18 F400

; Hole 3
G0 Z5
G0 X350 Y250
G1 Z-18 F400

; Hole 4
G0 Z5
G0 X200 Y150
G1 Z-18 F400

; === Edge profile — bottom edge channel ===
G0 Z5
G0 X10 Y10
G1 Z-4 F600
G1 X390 Y10 F2500      ; Long straight channel

; === Hinge cup bores — Forstner 35mm ===
; European cup hinge standard: 35mm diameter, 13mm deep
M5
T4 M6        ; 35mm Forstner bit
S600 M3      ; Low RPM for large Forstner
G0 X50 Y150 Z5
G1 Z-13 F150         ; Bore hinge cup — left side
G0 Z5
G0 X350 Y150
G1 Z-13 F150         ; Bore hinge cup — right side
G0 Z5

; === Decorative rounded groove — 8mm ball end mill ===
M5
T5 M6        ; 8mm ball end mill
S14000 M3
G0 X110 Y280 Z5
G1 Z-3 F400            ; Plunge
G1 X290 Y280 F1800     ; Groove along top edge of panel

; === Circular arc pocket — handle recess (G2/G3) ===
M5
T1 M6        ; 6mm flat end mill
S18000 M3
G0 X200 Y50 Z5
G1 Z-4 F600            ; Plunge into handle recess
G2 X220 Y50 I10 J0 F1500   ; CW semicircle right
G2 X200 Y50 I-10 J0        ; CW semicircle back (full circle)

; === Shelf pin holes — G81 drilling cycle ===
M5
T2 M6        ; 8mm drill
S3000 M3
G81 X30 Y80 Z-12 R2 F200   ; First shelf pin hole
X30 Y130                     ; Modal repeat
X30 Y180                     ; Modal repeat
X30 Y230                     ; Modal repeat
X370 Y80                     ; Right side
X370 Y130
X370 Y180
X370 Y230
G80                           ; Cancel drilling cycle

; === Cleanup ===
G0 Z50                 ; Retract high
M5                     ; Spindle off
M30                    ; Program end
