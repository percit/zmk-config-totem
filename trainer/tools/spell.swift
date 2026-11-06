import AppKit
let lang = CommandLine.arguments[1]
let sc = NSSpellChecker.shared
guard sc.setLanguage(lang) else { FileHandle.standardError.write("no lang \(lang)\n".data(using:.utf8)!); exit(2) }
while let w = readLine() {
  let r = sc.checkSpelling(of: w, startingAt: 0, language: lang, wrap: false, inSpellDocumentWithTag: 0, wordCount: nil)
  if r.location == NSNotFound { print(w) }
}
