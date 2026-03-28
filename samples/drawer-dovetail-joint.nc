; Drawer box with dovetail joints
; Tests angled milling operations for traditional wood joinery
; Workpiece: 300x250x15

; === Setup ===
G90          ; Absolute positioning
G21          ; Millimeters
T1 M6        ; 6mm flat end mill for pocketing
T2 M6        ; 12mm dovetail bit (45-degree angle)
S16000 M3

; === Front Panel — Left Dovetail Slot ===
G0 X20 Y50 Z5
G1 Z-8 F600
G1 X50 Y50 F1500
G1 X50 Y200
G1 X20 Y200
G1 X20 Y50

; === Front Panel — Right Dovetail Slot ===
G0 X250 Y50 Z5
G1 Z-8 F600
G1 X280 Y50 F1500
G1 X280 Y200
G1 X250 Y200
G1 X250 Y50

; === Front Panel — Bottom Channel ===
G0 X20 Y120 Z5
G1 Z-6 F500
G1 X280 Y120 F1200
G1 X280 Y135
G1 X20 Y135
G1 X20 Y120

; === Front Panel — Finger Pull (top edge) ===
G0 X130 Y5 Z5
G1 Z-5 F500
G1 X170 Y5 F1500
G1 X170 Y15
G1 X130 Y15
G1 X130 Y5

; === Back Panel — Left Dovetail Slot ===
G0 X20 Y50 Z5
G1 Z-8 F600
G1 X50 Y50 F1500
G1 X50 Y100
G1 X20 Y100
G1 X20 Y50

; === Back Panel — Right Dovetail Slot ===
G0 X250 Y50 Z5
G1 Z-8 F600
G1 X280 Y50 F1500
G1 X280 Y100
G1 X250 Y100
G1 X250 Y50

; === Back Panel — Bottom Channel ===
G0 X20 Y70 Z5
G1 Z-6 F500
G1 X280 Y70 F1200
G1 X280 Y85
G1 X20 Y85
G1 X20 Y70

; === Left Side Panel — Front Dovetail Slot ===
G0 X50 Y20 Z5
G1 Z-8 F600
G1 X50 Y50 F1500
G1 X100 Y50
G1 X100 Y20
G1 X50 Y20

; === Left Side Panel — Back Dovetail Slot ===
G0 X50 Y200 Z5
G1 Z-8 F600
G1 X50 Y230 F1500
G1 X100 Y230
G1 X100 Y200
G1 X50 Y200

; === Left Side Panel — Bottom Groove ===
G0 X50 Y75 Z5
G1 Z-6 F500
G1 X50 Y175 F1200

; === Right Side Panel — Front Dovetail Slot ===
G0 X200 Y20 Z5
G1 Z-8 F600
G1 X200 Y50 F1500
G1 X250 Y50
G1 X250 Y20
G1 X200 Y20

; === Right Side Panel — Back Dovetail Slot ===
G0 X200 Y200 Z5
G1 Z-8 F600
G1 X200 Y230 F1500
G1 X250 Y230
G1 X250 Y200
G1 X200 Y200

; === Right Side Panel — Bottom Groove ===
G0 X200 Y75 Z5
G1 Z-6 F500
G1 X200 Y175 F1200

; === Subdivision Holes (for shelf supports) ===
T3 M6        ; 6mm drill bit
S4000 M3

; Left side shelf peg holes
G0 X50 Y80 Z5
G1 Z-7 F350

G0 X50 Y125 Z5
G1 Z-7 F350

G0 X50 Y170 Z5
G1 Z-7 F350

; Right side shelf peg holes
G0 X250 Y80 Z5
G1 Z-7 F350

G0 X250 Y125 Z5
G1 Z-7 F350

G0 X250 Y170 Z5
G1 Z-7 F350

; === Cleanup ===
G0 Z50
M5
M30
