; Ramp milling test — tool descends along a slope from Z0 to Z-18
; Tests diagonal tool sweeps where X/Y and Z change simultaneously
; Workpiece: 400x300x18

; === Setup ===
G90          ; Absolute positioning
G21          ; Millimeters
T1 M6        ; 8mm flat end mill
S18000 M3    ; Spindle on CW

; === Test 1: Simple straight ramp along X axis ===
; Tool ramps from Z0 down to Z-18 while moving in X
G0 X10 Y50 Z5         ; Rapid above start
G1 Z0 F800            ; Touch surface
G1 X200 Z-18 F1000    ; Ramp: 190mm lateral, 18mm deep

; === Test 2: Ramp along Y axis ===
G0 Z5
G0 X300 Y10
G1 Z0 F800
G1 Y290 Z-18 F1000    ; Ramp along Y: 280mm lateral, full depth

; === Test 3: Diagonal ramp (X and Y change together) ===
G0 Z5
G0 X30 Y200
G1 Z0 F800
G1 X180 Y280 Z-12 F1000 ; Diagonal ramp to 12mm depth

; === Test 4: Multi-step staircase ramp ===
; Descend in steps — each segment goes deeper
G0 Z5
G0 X220 Y200
G1 Z0 F800
G1 X260 Y200 Z-4 F1200   ; Step 1: 0 to -4mm
G1 X300 Y200 Z-8 F1200   ; Step 2: -4 to -8mm
G1 X340 Y200 Z-12 F1200  ; Step 3: -8 to -12mm
G1 X380 Y200 Z-18 F1200  ; Step 4: -12 to -18mm (through)

; === Test 5: Zigzag ramp (pocket with ramping entry) ===
; Enter pocket with ramp, then mill flat at depth
G0 Z5
G0 X50 Y120
G1 Z0 F800
G1 X150 Y120 Z-6 F800    ; Ramp entry into pocket
; Now mill flat at Z-6
G1 X150 Y180 F1500
G1 X50 Y180
G1 X50 Y130
G1 X150 Y130
G1 X150 Y170
G1 X50 Y170
G1 X50 Y140
G1 X150 Y140
G1 X150 Y160
G1 X50 Y160
G1 X50 Y150
G1 X150 Y150

; === Test 6: Helical-approximation ramp (spiral descent) ===
; Approximate a helix with linear segments — circular ramp entry
G0 Z5
G0 X300 Y120
G1 Z0 F800
G1 X340 Y120 Z-3 F600    ; Segment 1
G1 X340 Y160 Z-6 F600    ; Segment 2
G1 X300 Y160 Z-9 F600    ; Segment 3
G1 X300 Y120 Z-12 F600   ; Segment 4
G1 X340 Y120 Z-15 F600   ; Segment 5
G1 X340 Y160 Z-18 F600   ; Segment 6 — full depth

; === Cleanup ===
G0 Z50                ; Retract high
M5                     ; Spindle off
M30                    ; Program end
