API Fixes + Pagination ✅

**CRITICAL BUG FIX** ⏳ (answers persist across pages)
- Bug: Selected options lost on page change (DOM clear).
- Fix: renderPaginatedExam(): After HTML append, loop options → if q.userAnswer, add 'selected' class.

Status: Ready to implement.
