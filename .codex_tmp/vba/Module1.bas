Attribute VB_Name = "Module1"
Option Explicit

' ==== TOMBOL INPUT (FINAL, revisi & gabungan) ====
Sub InputData()
    Dim wsForm As Worksheet, wsLog As Worksheet, wsLOLog As Worksheet, wsDV As Worksheet
    Dim loTemp As ListObject, loLog As ListObject
    Dim transType As String, prefix As String, taggingType As String
    Dim notaNo As String, materialName As String
    Dim nextNo As Long, numPart As Long, colNota As Long
    Dim tahun As String, bulan As String
    Dim r As Range, i As Long
    Dim lr As ListRow, target As Range
    Dim lineID As Long, maxID As Variant
    Dim gotBlank As Boolean
    
    Dim whName As String, whID As String
    Dim foundRow As Range
    
    ' --------- Sheet dan table name ----------
    Set wsForm = ThisWorkbook.Sheets("Transaction_Form")
    Set wsLog = ThisWorkbook.Sheets("Logfile")
    Set wsLOLog = ThisWorkbook.Sheets("LO_Logfile")
    Set wsDV = ThisWorkbook.Sheets("DV")
    Set loTemp = wsForm.ListObjects("Temp_Table")

    ' --------- alamat baru (setelah penambahan Tagging Type) ----------
    ' C3 = Tagging Type, C4 = Transaction Type, C5 = Nota No, C6 = WH GCI
    ' C8 = Date, C9 = Time, C12 = Material Name, C14 = Unit
    ' ------------------------------------------------------------------

    ' --- Tagging Type ---
    taggingType = Trim$(wsForm.Range("C3").Value)
    If Len(taggingType) = 0 Then
        MsgBox "Tagging Type wajib diisi!", vbExclamation
        Exit Sub
    End If
    
' --- Transaction Type & prefix (robust, normalisasi input) ---
Dim rawType As String
rawType = wsForm.Range("C4").Value

' replace non-breaking spaces, trim outer & collapse multi-spaces, then uppercase
rawType = Replace(rawType, Chr(160), " ")                           ' non-breaking -> normal space
rawType = Application.WorksheetFunction.Trim(rawType)               ' remove extra internal spaces
transType = UCase$(rawType)                                         ' normalized uppercase for comparison

Select Case transType
    Case "BORROW IN":    prefix = "BOI"
    Case "BORROW OUT":   prefix = "BOO"
    Case "TRANSFER IN":  prefix = "TFI"
    Case "TRANSFER OUT": prefix = "TFO"
    Case "INBOUND":      prefix = "INB"
    Case "OUTBOUND":     prefix = "OUB"
    Case "RETURN IN":    prefix = "RIN"   ' <<< new prefix
    Case "RETURN OUT":   prefix = "ROO"   ' <<< new prefix
    Case Else
        MsgBox "Transaction Type tidak valid!" & vbCrLf & _
               "Nilai C4 (normalised) = '" & transType & "'", vbExclamation
        Exit Sub
End Select

    
    ' --- WHID (C6) ---
    whName = Trim$(wsForm.Range("C6").Value)
    If Len(whName) = 0 Then
        MsgBox "Warehouse wajib diisi!", vbExclamation
        Exit Sub
    End If
    Set foundRow = wsDV.Range("E:E").Find(whName, LookAt:=xlWhole)
    If foundRow Is Nothing Then
        MsgBox "WH Name tidak ditemukan di DV!", vbCritical
        Exit Sub
    Else
        whID = foundRow.Offset(0, -1).Value
    End If
    
    'fREEZE dLU------------
    'tahun = Format(Date, "YY")
    'bulan = Format(Date, "MM")
    
    ' --- Pilih tabel referensi nomor nota berdasar Tagging Type ---
    If UCase$(taggingType) = "LOGFILE" Then
        Set loLog = wsLog.ListObjects("Logfile_S")
    ElseIf UCase$(taggingType) = "LEFTOVERS" Then
        Set loLog = wsLOLog.ListObjects("LO_Logfile")
    Else
        MsgBox "Tagging Type tidak dikenali (Logfile / Leftovers).", vbExclamation
        Exit Sub
    End If
    
    ' --- Generate Nota No (harus cek duplikat di log file) Freeze Dulu---
    'If Len(wsForm.Range("C5").Value) = 0 Then    ' jika kosong ? generate baru
        'nextNo = 1
        'If Not loLog Is Nothing Then
            'If Not loLog.DataBodyRange Is Nothing Then
                'colNota = ColIndexByName(loLog, "Nota No")
                'If colNota > 0 Then
                    'For Each r In loLog.ListColumns(colNota).DataBodyRange
                        'If Len(r.Value) > 0 Then
                            'If Left$(CStr(r.Value), 3) = prefix And _
                               'Mid$(CStr(r.Value), 5, Len(whID)) = whID And _
                               'Mid$(CStr(r.Value), 5 + Len(whID), 2) = tahun And _
                               'Mid$(CStr(r.Value), 7 + Len(whID), 2) = bulan Then
                                    'numPart = Val(Right$(CStr(r.Value), 3))
                                    'If numPart >= nextNo Then nextNo = numPart + 1
                            'End If
                        'End If
                    'Next r
                'End If
            'End If
        'End If
        'notaNo = prefix & "-" & whID & tahun & bulan & "-" & Format$(nextNo, "000")
        'wsForm.Range("C5").Value = notaNo
    'Else
        ' kalau user isi manual, tetap cek apakah sudah dipakai di log
        'notaNo = wsForm.Range("C5").Value
        'colNota = ColIndexByName(loLog, "Nota No")
        'If colNota > 0 Then
            'If Application.WorksheetFunction.CountIf(loLog.ListColumns(colNota).DataBodyRange, notaNo) > 0 Then
                'MsgBox "Nota No " & notaNo & " sudah ada di " & taggingType & "!" & vbCrLf & _
                       '"Harap kosongkan C5 agar nomor otomatis.", vbCritical
                'Exit Sub
            'End If
        'End If
    'End If

    ' --- Timestamp (C8/C9) Freeze dulu---
    'wsForm.Range("C8").Value = Date
    'wsForm.Range("C9").Value = Time

    ' --- Validasi Material Name (C12) ---
    materialName = Trim$(wsForm.Range("C12").Value)
    If Len(materialName) = 0 Then
        MsgBox "Material Name wajib diisi.", vbExclamation
        Exit Sub
    End If

    ' --- Reminder khusus kabel (Inbound/Borrow In/Transfer In + Unit=Meter) ---
   If (transType = "INBOUND" Or transType = "BORROW IN" Or transType = "TRANSFER IN" Or transType = "RETURN IN") _
   And UCase$(Trim$(wsForm.Range("C14").Value)) = "METER" Then
        MsgBox "Jika Input Material kabel Sisa / Material damage, pastikan input Tagging type = Leftovers", vbInformation
    End If
    
    ' --- Cari baris kosong / tambah baris baru ---
    If loTemp.DataBodyRange Is Nothing Then
        Set lr = loTemp.ListRows.Add
        Set target = lr.Range
    Else
        gotBlank = False
        For Each lr In loTemp.ListRows
            If Application.WorksheetFunction.CountA(lr.Range) = 0 Then
                Set target = lr.Range
                gotBlank = True
                Exit For
            End If
        Next lr
        If Not gotBlank Then
            Set lr = loTemp.ListRows.Add
            Set target = lr.Range
        End If
    End If

    ' --- Line_ID (berdasar Max + 1) ---
    If loTemp.DataBodyRange Is Nothing Then
        lineID = 1
    Else
        On Error Resume Next
        maxID = Application.WorksheetFunction.Max(loTemp.ListColumns("Line_ID").DataBodyRange)
        On Error GoTo 0
        If IsError(maxID) Or Len(maxID) = 0 Then maxID = 0
        lineID = CLng(maxID) + 1
    End If
    target.Cells(1, 1).Value = lineID   ' kolom 1 = Line_ID

    ' --- Copy form ke tabel: SKIP Tagging Type (mulai C4 sampai C24) ---
    Dim vals As Variant
    vals = wsForm.Range("C4:C25").Value
    For i = 1 To UBound(vals, 1)
        target.Cells(1, i + 1).Value = vals(i, 1)
    Next i

    MsgBox "Data masuk ke Temp_Table." & vbCrLf & _
           "Line_ID : " & lineID & vbCrLf & _
           "Nota No : " & notaNo & vbCrLf & _
           "Tagging : " & taggingType, vbInformation
End Sub


' ==== TOMBOL CLEAR ====
Sub ClearData()
    Dim wsTemp As Worksheet
    Dim tblTemp As ListObject
    Dim pilihan As VbMsgBoxResult
    Dim rowID As Variant
    Dim rng As Range
    Dim foundCell As Range
    
    Set wsTemp = ThisWorkbook.Sheets("Transaction_Form")
    Set tblTemp = wsTemp.ListObjects("Temp_Table") ' pastikan nama tabel benar
    
    If tblTemp.DataBodyRange Is Nothing Then
        MsgBox "Tidak ada data di Temp_Table!", vbInformation
        Exit Sub
    End If
    
    ' Tanya user mau hapus semua atau per baris
    pilihan = MsgBox("Pilih Yes untuk Clear All (hapus semua data)" & vbCrLf & _
                     "Pilih No untuk Clear Row (hapus baris tertentu)", _
                     vbYesNoCancel + vbQuestion, "Clear Data")
    
    If pilihan = vbCancel Then Exit Sub
    
    ' === Clear All ===
    If pilihan = vbYes Then
        tblTemp.DataBodyRange.Delete
        wsTemp.Range("C5").ClearContents   ' reset Nota No (opsional)
        wsTemp.Range("C12").ClearContents  ' reset Material Name (opsional)
        
        MsgBox "Semua data di Temp_Table sudah dihapus!" & vbCrLf & _
               "Line_ID akan dimulai dari 1 saat input berikutnya.", vbInformation
    End If
    
    ' === Clear Row ===
    If pilihan = vbNo Then
        Do
            rowID = InputBox("Masukkan Line_ID yang ingin dihapus:" & vbCrLf & _
                             "(Kosongkan input untuk batal)", "Clear Row")
            
            If rowID = "" Then Exit Do
            
            ' Cari Line_ID di tabel
            Set rng = tblTemp.ListColumns("Line_ID").DataBodyRange
            Set foundCell = rng.Find(What:=CLng(rowID), LookIn:=xlValues, LookAt:=xlWhole)
            
            If Not foundCell Is Nothing Then
                ' Hapus baris di tabel
                tblTemp.ListRows(foundCell.Row - tblTemp.HeaderRowRange.Row).Delete
                ' Renumber ulang Line_ID
                Call RenumberLineID(tblTemp)
                MsgBox "Line_ID " & rowID & " berhasil dihapus dan nomor diurutkan ulang!", vbInformation
            Else
                MsgBox "Line_ID " & rowID & " tidak ditemukan!", vbExclamation
            End If
        Loop
    End If
End Sub

' ==== SUB UNTUK URUT ULANG NOMOR ====
Sub RenumberLineID(tbl As ListObject)
    Dim i As Long
    If tbl.DataBodyRange Is Nothing Then Exit Sub
    
    For i = 1 To tbl.ListRows.Count
        tbl.DataBodyRange.Cells(i, tbl.ListColumns("Line_ID").Index).Value = i
    Next i
End Sub


'==== HELPER: normalisasi nama header (abaikan ., /, -, underscore, spasi ganda) ====
Private Function CleanHeader(ByVal s As String) As String
    Dim t As String
    t = LCase$(Trim$(s))
    t = Replace(t, "_", " ")
    t = Replace(t, "-", " ")
    t = Replace(t, "/", " ")
    t = Replace(t, ".", "")
    Do While InStr(t, "  ") > 0
        t = Replace(t, "  ", " ")
    Loop
    CleanHeader = t
End Function

Private Function ColIndexByName(lo As ListObject, headerName As String) As Long
    Dim i As Long, tgt As String
    tgt = CleanHeader(headerName)
    For i = 1 To lo.ListColumns.Count
        If CleanHeader(lo.ListColumns(i).Name) = tgt Then
            ColIndexByName = i
            Exit Function
        End If
    Next i
    ColIndexByName = 0
End Function

' ==== TOMBOL PROCESS ====
Sub ProcessData()
    Dim wsTemp As Worksheet, wsLog As Worksheet, wsLOLog As Worksheet
    Dim tblTemp As ListObject, tblLog As ListObject
    Dim msg As VbMsgBoxResult
    Dim srcRow As ListRow, dstRow As ListRow
    Dim taggingType As String
    
    Set wsTemp = ThisWorkbook.Sheets("Transaction_Form")
    Set wsLog = ThisWorkbook.Sheets("Logfile")
    Set wsLOLog = ThisWorkbook.Sheets("LO_Logfile")
    Set tblTemp = wsTemp.ListObjects("Temp_Table")
    
    taggingType = Trim$(wsTemp.Range("C3").Value)
    If Len(taggingType) = 0 Then
        MsgBox "Tagging Type wajib diisi!", vbExclamation
        Exit Sub
    End If
    
    ' Tentukan tabel target
    If UCase$(taggingType) = "LOGFILE" Then
        Set tblLog = wsLog.ListObjects("Logfile_S")
    ElseIf UCase$(taggingType) = "LEFTOVERS" Then
        Set tblLog = wsLOLog.ListObjects("LO_Logfile")
    Else
        MsgBox "Tagging Type tidak dikenali (hanya: Logfile / Leftovers).", vbExclamation
        Exit Sub
    End If
    
    If tblTemp Is Nothing Or tblTemp.DataBodyRange Is Nothing Then
        MsgBox "Tidak ada data di Temp_Table.", vbExclamation
        Exit Sub
    End If
    
    msg = MsgBox("Process data to " & taggingType & "?", vbYesNo + vbQuestion, "Confirmation")
    If msg = vbNo Then Exit Sub
    
    ' Daftar kolom yang dipetakan
    Dim fields As Variant
    fields = Array("Line ID", "Transaction Type", "Nota No", "WH GCI", "PIC Warehouse", "Date", _
                   "Time", "Material Source Destination", "Type Material", "Material Name", _
                   "Material Code", "Unit", "Qty", "SiteID", "Site Name", "DO Number", _
                   "DN Number", "Condition", "PIC Delivery", "Vendor Supplier", "ID Card", _
                   "Car Plate", "Remarks")
    
    ' Proses baris satu per satu, map by name
    For Each srcRow In tblTemp.ListRows
        If Application.WorksheetFunction.CountA(srcRow.Range) > 0 Then
            Set dstRow = tblLog.ListRows.Add
            
            Dim nm As Variant
            Dim sIdx As Long, lIdx As Long
            For Each nm In fields
                sIdx = ColIndexByName(tblTemp, CStr(nm))
                lIdx = ColIndexByName(tblLog, CStr(nm))
                If sIdx > 0 And lIdx > 0 Then
                    dstRow.Range.Cells(1, lIdx).Value = srcRow.Range.Cells(1, sIdx).Value
                End If
            Next nm
        End If
    Next srcRow
    
    ' Bersihkan isi Temp_Table
    If Not tblTemp.DataBodyRange Is Nothing Then
        tblTemp.DataBodyRange.Delete
        wsTemp.Range("C5").ClearContents   ' reset Nota No (opsional)
        wsTemp.Range("C12").ClearContents  ' reset Material Name (opsional)
               
    End If
    
    ' Bersihkan sebagian form input
Dim cell As Range
With wsTemp
    For Each cell In .Range("C3:C25")
        Select Case cell.Address(False, False)
            Case "C13", "C14", "C16", "C18", "C19", "C7", "C11"
                ' jangan di-clear
            Case Else
                cell.ClearContents
        End Select
    Next cell
End With

    
    MsgBox "Data berhasil diproses ke " & taggingType & ".", vbInformation
End Sub







