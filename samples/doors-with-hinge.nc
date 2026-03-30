; gcode-viewer demo — furniture panel with pockets and holes
; Workpiece: 713x496x22

; === Setup ===
G90          ; Absolute positioning
G21          ; Millimeters
T4 M6        ; 35mm
S18000 M3    ; Spindle on CW

; Hole 1
G0 Z5
G0 X100 Y21.5
G1 Z-13 F300

; Hole 2
G0 Z5
G0 X613 Y21.5
G1 Z-13 F300

M5
T3 M6        ; 5mm
S18000 M3    ; Spindle on CW

; Hole 3
G0 Z5
G0 X77.5 Y31
G1 Z-13 F300

; Hole 4
G0 Z5
G0 X122.5 Y31
G1 Z-13 F300

; Hole 5
G0 Z5
G0 X590.5 Y31
G1 Z-13 F300

; Hole 6
G0 Z5
G0 X635.5 Y31
G1 Z-13 F300

; === Cleanup ===
G0 Z50                 ; Retract high
M5                     ; Spindle off
M30                    ; Program end
