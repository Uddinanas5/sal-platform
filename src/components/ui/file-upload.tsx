"use client"

import * as React from "react"
import { Upload, X, FileIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface FileUploadProps {
  onFilesSelected?: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSize?: number
  className?: string
}

export function FileUpload({
  onFilesSelected,
  accept,
  multiple = false,
  maxSize = 5 * 1024 * 1024,
  className,
}: FileUploadProps) {
  const [dragActive, setDragActive] = React.useState(false)
  const [files, setFiles] = React.useState<File[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.size <= maxSize)
    const newFiles = multiple ? [...files, ...droppedFiles] : droppedFiles.slice(0, 1)
    setFiles(newFiles)
    onFilesSelected?.(newFiles)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter((f) => f.size <= maxSize)
    const newFiles = multiple ? [...files, ...selectedFiles] : selectedFiles.slice(0, 1)
    setFiles(newFiles)
    onFilesSelected?.(newFiles)
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    onFilesSelected?.(newFiles)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
          dragActive ? "border-sal-500 bg-sal-50" : "border-input hover:border-sal-300 hover:bg-sal-50/50"
        )}
      >
        <Upload className={cn("h-8 w-8 mb-2", dragActive ? "text-sal-500" : "text-muted-foreground")} />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-sal-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max file size: {Math.round(maxSize / 1024 / 1024)}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
        />
      </div>
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border p-2">
              <FileIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)}KB</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
