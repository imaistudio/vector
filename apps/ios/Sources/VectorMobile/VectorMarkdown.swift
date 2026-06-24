import Foundation

public enum VectorMarkdownBlock: Equatable, Sendable {
  case heading(level: Int, text: String)
  case paragraph(String)
  case unorderedList([String])
  case orderedList([String])
  case codeBlock(String)
  case quote(String)
  case horizontalRule
}

public enum VectorMarkdownParser {
  public static func parse(_ markdown: String) -> [VectorMarkdownBlock] {
    var blocks: [VectorMarkdownBlock] = []
    var paragraphLines: [String] = []
    var listItems: [String] = []
    var orderedItems: [String] = []
    var quoteLines: [String] = []
    var codeLines: [String] = []
    var isInsideCodeFence = false

    func flushParagraph() {
      guard !paragraphLines.isEmpty else { return }
      blocks.append(.paragraph(paragraphLines.joined(separator: " ")))
      paragraphLines.removeAll()
    }

    func flushUnorderedList() {
      guard !listItems.isEmpty else { return }
      blocks.append(.unorderedList(listItems))
      listItems.removeAll()
    }

    func flushOrderedList() {
      guard !orderedItems.isEmpty else { return }
      blocks.append(.orderedList(orderedItems))
      orderedItems.removeAll()
    }

    func flushQuote() {
      guard !quoteLines.isEmpty else { return }
      blocks.append(.quote(quoteLines.joined(separator: "\n")))
      quoteLines.removeAll()
    }

    func flushFlowBlocks() {
      flushParagraph()
      flushUnorderedList()
      flushOrderedList()
      flushQuote()
    }

    for rawLine in markdown.components(separatedBy: .newlines) {
      let line = rawLine.trimmingCharacters(in: .whitespaces)

      if line.hasPrefix("```") {
        if isInsideCodeFence {
          blocks.append(.codeBlock(codeLines.joined(separator: "\n")))
          codeLines.removeAll()
          isInsideCodeFence = false
        } else {
          flushFlowBlocks()
          isInsideCodeFence = true
        }
        continue
      }

      if isInsideCodeFence {
        codeLines.append(rawLine)
        continue
      }

      if line.isEmpty {
        flushFlowBlocks()
        continue
      }

      if isHorizontalRule(line) {
        flushFlowBlocks()
        blocks.append(.horizontalRule)
        continue
      }

      if let heading = parseHeading(line) {
        flushFlowBlocks()
        blocks.append(.heading(level: heading.level, text: heading.text))
        continue
      }

      if let item = parseUnorderedListItem(line) {
        flushParagraph()
        flushOrderedList()
        flushQuote()
        listItems.append(item)
        continue
      }

      if let item = parseOrderedListItem(line) {
        flushParagraph()
        flushUnorderedList()
        flushQuote()
        orderedItems.append(item)
        continue
      }

      if line.hasPrefix(">") {
        flushParagraph()
        flushUnorderedList()
        flushOrderedList()
        quoteLines.append(String(line.dropFirst()).trimmingCharacters(in: .whitespaces))
        continue
      }

      flushUnorderedList()
      flushOrderedList()
      flushQuote()
      paragraphLines.append(line)
    }

    if isInsideCodeFence {
      blocks.append(.codeBlock(codeLines.joined(separator: "\n")))
    }
    flushFlowBlocks()

    return blocks
  }

  private static func parseHeading(_ line: String) -> (level: Int, text: String)? {
    let markers = line.prefix { $0 == "#" }
    guard (1...6).contains(markers.count) else { return nil }
    let remainder = line.dropFirst(markers.count)
    guard remainder.first == " " else { return nil }
    let text = remainder.trimmingCharacters(in: .whitespaces)
    return text.isEmpty ? nil : (markers.count, text)
  }

  private static func parseUnorderedListItem(_ line: String) -> String? {
    guard line.count > 2 else { return nil }
    let marker = line.prefix(2)
    guard marker == "- " || marker == "* " else { return nil }
    return String(line.dropFirst(2)).trimmingCharacters(in: .whitespaces)
  }

  private static func parseOrderedListItem(_ line: String) -> String? {
    guard let dotIndex = line.firstIndex(of: ".") else { return nil }
    let number = line[..<dotIndex]
    guard !number.isEmpty, number.allSatisfy(\.isNumber) else { return nil }
    let afterDot = line.index(after: dotIndex)
    guard afterDot < line.endIndex, line[afterDot] == " " else { return nil }
    return String(line[line.index(after: afterDot)...]).trimmingCharacters(in: .whitespaces)
  }

  private static func isHorizontalRule(_ line: String) -> Bool {
    let compact = line.replacingOccurrences(of: " ", with: "")
    return compact.count >= 3 && (compact.allSatisfy { $0 == "-" } || compact.allSatisfy { $0 == "*" })
  }
}
