"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  ArrowRight, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Download
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { GENDER } from "@/lib/constants"
import { useTranslations } from "next-intl"

interface ParsedStudent {
  firstName: string
  lastName: string
  fatherName?: string
  gender: 'MALE' | 'FEMALE'
  phone?: string
  cin?: string
  address?: string
  dateOfBirth?: string
  placeOfBirth?: string
  educationLevel?: string
  notes?: string
  valid: boolean
  errors: string[]
}

interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export default function ImportStudentsPage() {
  const router = useRouter()
  const { success, error, warning } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const t = useTranslations("admin.students")
  const tc = useTranslations("common")

  const parseCSV = useCallback((content: string): ParsedStudent[] => {
    const lines = content.split("\n").filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase())
    const students: ParsedStudent[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim())
      const errors: string[] = []

      // Get firstName (required)
      const firstName = values[headers.indexOf("firstname")] || 
                        values[headers.indexOf("الاسم")] ||
                        values[headers.indexOf("first_name")] ||
                        values[0]

      // Get lastName (required)
      const lastName = values[headers.indexOf("lastname")] ||
                       values[headers.indexOf("اللقب")] ||
                       values[headers.indexOf("last_name")] ||
                       values[1]

      // Validate required fields
      if (!firstName || firstName.length < 2) {
        errors.push(t("firstNameValidation"))
      }
      if (!lastName || lastName.length < 2) {
        errors.push(t("lastNameValidation"))
      }

      // Get gender (required, default to MALE)
      let genderRaw = values[headers.indexOf("gender")] ||
                      values[headers.indexOf("الجنس")] ||
                      values[headers.indexOf("sex")] ||
                      ''
      genderRaw = genderRaw.toUpperCase()
      let gender: 'MALE' | 'FEMALE' = GENDER.MALE
      if (genderRaw === 'FEMALE' || genderRaw === 'أنثى' || genderRaw === 'F' || genderRaw === 'انثى') {
        gender = GENDER.FEMALE
      }

      // Get fatherName
      const fatherName = values[headers.indexOf("fathername")] ||
                         values[headers.indexOf("اسم الأب")] ||
                         values[headers.indexOf("father_name")] ||
                         values[headers.indexOf("parentname")] ||
                         values[headers.indexOf("اسم الولي")] ||
                         undefined

      // Get phone
      let phone = values[headers.indexOf("phone")] ||
                  values[headers.indexOf("الهاتف")] ||
                  values[headers.indexOf("tel")] ||
                  undefined
      
      // Normalize Tunisia phone number
      if (phone) {
        phone = phone.replace(/\s/g, '').replace(/-/g, '')
        if (!phone.startsWith('+216') && phone.length === 8) {
          phone = '+216' + phone
        }
      }

      // Get CIN
      const cin = values[headers.indexOf("cin")] ||
                  values[headers.indexOf("رقم ب. ت. و")] ||
                  values[headers.indexOf("id")] ||
                  undefined

      // Get address
      const address = values[headers.indexOf("address")] ||
                      values[headers.indexOf("العنوان")] ||
                      undefined

      // Get other optional fields
      const dateOfBirth = values[headers.indexOf("dateofbirth")] ||
                          values[headers.indexOf("تاريخ الولادة")] ||
                          values[headers.indexOf("birth_date")] ||
                          undefined

      const placeOfBirth = values[headers.indexOf("placeofbirth")] ||
                           values[headers.indexOf("مكان الولادة")] ||
                           values[headers.indexOf("birth_place")] ||
                           undefined

      const educationLevel = values[headers.indexOf("educationlevel")] ||
                             values[headers.indexOf("المستوى التعليمي")] ||
                             values[headers.indexOf("education")] ||
                             undefined

      const notes = values[headers.indexOf("notes")] ||
                    values[headers.indexOf("ملاحظات")] ||
                    undefined

      students.push({
        firstName: firstName || "",
        lastName: lastName || "",
        fatherName,
        gender,
        phone,
        cin,
        address,
        dateOfBirth,
        placeOfBirth,
        educationLevel,
        notes,
        valid: errors.length === 0 && !!firstName && !!lastName,
        errors
      })
    }

    return students
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setImportResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const parsed = parseCSV(content)
      setParsedStudents(parsed)
    }
    reader.readAsText(selectedFile)
  }, [parseCSV])

  const handleImport = async () => {
    const validStudents = parsedStudents.filter(s => s.valid)
    if (validStudents.length === 0) {
      warning(t("importWarningTitle"), t("noValidData"))
      return
    }

    setIsImporting(true)
    let successCount = 0
    let failedCount = 0
    const importErrors: string[] = []

    for (const student of validStudents) {
      try {
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: student.firstName,
            lastName: student.lastName,
            fatherName: student.fatherName,
            gender: student.gender,
            phone: student.phone,
            cin: student.cin,
            address: student.address,
            dateOfBirth: student.dateOfBirth,
            placeOfBirth: student.placeOfBirth,
            educationLevel: student.educationLevel,
            notes: student.notes,
            activityAreas: [],
            declarationAccepted: true, // Auto-accept for import
            signatureLocation: t("importSignatureLocation"),
            signatureDate: new Date().toISOString().split('T')[0],
          })
        })

        if (res.ok) {
          successCount++
        } else {
          const data = await res.json()
          failedCount++
          importErrors.push(`${student.firstName} ${student.lastName}: ${data.message}`)
        }
      } catch (err) {
        failedCount++
        importErrors.push(`${student.firstName} ${student.lastName}: ${t("connectionError")}`)
      }
    }

    setImportResult({ success: successCount, failed: failedCount, errors: importErrors })
    setIsImporting(false)

    if (successCount > 0 && failedCount === 0) {
      success(t("importSuccessTitle"), t("importSuccessMessage", { count: successCount }))
    } else if (successCount > 0 && failedCount > 0) {
      warning(t("importPartialTitle"), t("importPartialMessage", { success: successCount, failed: failedCount }))
    } else if (failedCount > 0) {
      error(t("importFailedTitle"), t("importFailedMessage", { count: failedCount }))
    }
  }

  const downloadTemplate = () => {
    const csvContent = `firstName,lastName,gender,fatherName,phone,cin,address,dateOfBirth,placeOfBirth,educationLevel,notes
أحمد,محمد,MALE,محمد علي,94181481,12345678,صفاقس,2010-01-15,صفاقس,إعدادي,طالب جديد
فاطمة,الزهراء,FEMALE,علي أحمد,98765432,87654321,تونس,2012-03-20,تونس,ابتدائي,`
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "students-template.csv"
    a.click()
  }

  const validCount = parsedStudents.filter(s => s.valid).length
  const invalidCount = parsedStudents.filter(s => !s.valid).length

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/admin/students">
          <ArrowRight className="ml-2 h-4 w-4" />
          {t("backToList")}
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("importStudents")}</h1>
        <p className="text-muted-foreground">{t("importDescription")}</p>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t("importInstructions")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("importInstructionsDesc")}
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li><strong>firstName</strong> {t("importCol_firstName")}</li>
            <li><strong>lastName</strong> {t("importCol_lastName")}</li>
            <li><strong>gender</strong> {t("importCol_gender")}</li>
            <li><strong>fatherName</strong> {t("importCol_fatherName")}</li>
            <li><strong>phone</strong> {t("importCol_phone")}</li>
            <li><strong>cin</strong> {t("importCol_cin")}</li>
            <li><strong>address</strong> {t("importCol_address")}</li>
            <li><strong>dateOfBirth</strong> {t("importCol_dateOfBirth")}</li>
            <li><strong>placeOfBirth</strong> {t("importCol_placeOfBirth")}</li>
            <li><strong>educationLevel</strong> {t("importCol_educationLevel")}</li>
            <li><strong>notes</strong> {t("importCol_notes")}</li>
          </ul>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="ml-2 h-4 w-4" />
            {t("downloadCSVTemplate")}
          </Button>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>{t("uploadFile")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csvFile">{t("csvFile")}</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                {t("selectedFile")} {file.name}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {parsedStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t("dataPreview")}</span>
              <div className="flex gap-2">
                <Badge variant="success">
                  <CheckCircle className="ml-1 h-3 w-3" />
                  {validCount} {t("valid")}
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="ml-1 h-3 w-3" />
                    {invalidCount} {t("invalid")}
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tc("status")}</TableHead>
                    <TableHead>{t("firstName")}</TableHead>
                    <TableHead>{t("lastName")}</TableHead>
                    <TableHead>{t("gender")}</TableHead>
                    <TableHead>{t("fatherName")}</TableHead>
                    <TableHead>{tc("phone")}</TableHead>
                    <TableHead>{t("cinShortLabel")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedStudents.map((student, index) => (
                    <TableRow key={index} className={!student.valid ? "bg-destructive/10" : ""}>
                      <TableCell>
                        {student.valid ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{student.firstName}</TableCell>
                      <TableCell>{student.lastName}</TableCell>
                      <TableCell>
                        <Badge variant={student.gender === 'MALE' ? 'secondary' : 'outline'}>
                          {student.gender === 'MALE' ? tc("male") : tc("female")}
                        </Badge>
                      </TableCell>
                      <TableCell>{student.fatherName || "-"}</TableCell>
                      <TableCell dir="ltr">{student.phone || "-"}</TableCell>
                      <TableCell dir="ltr">{student.cin || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Alert variant={importResult.failed > 0 ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("importResult")}</AlertTitle>
          <AlertDescription>
            <p>{t("importSuccessCount", { count: importResult.success })}</p>
            {importResult.failed > 0 && (
              <p>{t("importFailedCount", { count: importResult.failed })}</p>
            )}
            {importResult.errors.length > 0 && (
              <ul className="mt-2 text-sm list-disc list-inside">
                {importResult.errors.slice(0, 5).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
                {importResult.errors.length > 5 && (
                  <li>{t("moreErrors", { count: importResult.errors.length - 5 })}</li>
                )}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      {parsedStudents.length > 0 && !importResult && (
        <div className="flex gap-3">
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                {t("importing")}
              </>
            ) : (
              <>
                <Upload className="ml-2 h-4 w-4" />
                {t("importNStudents", { count: validCount })}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFile(null)
              setParsedStudents([])
              setImportResult(null)
            }}
          >
            {tc("cancel")}
          </Button>
        </div>
      )}

      {importResult && importResult.success > 0 && (
        <Button asChild>
          <Link href="/admin/students">
            {t("backToStudentList")}
          </Link>
        </Button>
      )}
    </div>
  )
}
