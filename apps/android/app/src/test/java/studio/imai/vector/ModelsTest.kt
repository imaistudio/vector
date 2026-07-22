package studio.imai.vector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ModelsTest {
  @Test fun remoteOriginsRequireHttps() {
    assertEquals("https://imai.tech", VectorAuthApi.normalizeAppUrl("imai.tech/path?q=1"))
    assertEquals("http://127.0.0.1:3000", VectorAuthApi.normalizeAppUrl("127.0.0.1:3000"))
    assertEquals("http://[::1]:3000", VectorAuthApi.normalizeAppUrl("[::1]:3000"))
    assertThrows(IllegalArgumentException::class.java) { VectorAuthApi.normalizeAppUrl("http://example.com") }
  }

  @Test fun requestGroupingUsesPriorityWeightAndStatusLabels() {
    val high = Priority("high", "High", weight = 3.0)
    val low = Priority("low", "Low", weight = 1.0)
    val rows = listOf(
      RequestRow("1", "REQ-1", "Low", priorityId = low.id, status = "ready_for_review"),
      RequestRow("2", "REQ-2", "None", status = "new"),
      RequestRow("3", "REQ-3", "High", priorityId = high.id, status = "new"),
    )
    assertEquals(listOf("High", "Low", "No priority"), groupRequests(rows, RequestGroup.Priority, listOf(low, high)).map { it.label })
    assertEquals(listOf("Needs routing", "Ready for review"), groupRequests(rows, RequestGroup.Status, emptyList()).map { it.label })
  }

  @Test fun paginatedDocumentChunksStayOrderedAndSegmented() {
    val firstText = "A".repeat(512_000)
    val secondText = "B".repeat(512_000)
    val pageTwo = listOf(DocumentChunk("c2", "doc", "v1", 1.0, secondText))
    val pageOne = listOf(DocumentChunk("c1", "doc", "v1", 0.0, firstText))
    val merged = mergeDocumentChunks(pageTwo, pageOne, "doc", "v1")

    assertEquals(listOf("c1", "c2"), merged.map { it.id })
    assertEquals(2, merged.map { it.content }.size)
    assertEquals(firstText, merged[0].content)
    assertEquals(secondText, merged[1].content)
    val displaySegments = merged.flatMap { segmentDocumentText(it.content) }
    assertEquals(firstText + secondText, displaySegments.joinToString(""))
    assert(displaySegments.all { it.length <= 16 * 1024 })
  }

  @Test fun chunkMergeFiltersOldVersionsAndDuplicates() {
    val current = DocumentChunk("same", "doc", "v2", 0.0, "new")
    val duplicate = current.copy(content = "duplicate")
    val old = DocumentChunk("old", "doc", "v1", 0.0, "old")
    val otherDocument = DocumentChunk("other", "else", "v2", 0.0, "other")
    assertEquals(listOf(current), mergeDocumentChunks(listOf(current), listOf(duplicate, old, otherDocument), "doc", "v2"))
  }

  @Test fun displaySegmentsDoNotSplitEmojiSurrogatePairs() {
    val source = "a".repeat(16 * 1024 - 1) + "😀" + "tail"
    val segments = segmentDocumentText(source)
    assertEquals(source, segments.joinToString(""))
    assertEquals(true, segments[1].startsWith("😀"))
  }
}
