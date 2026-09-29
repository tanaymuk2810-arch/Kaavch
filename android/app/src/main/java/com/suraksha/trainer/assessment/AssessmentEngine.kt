package com.suraksha.trainer.assessment

/**
 * On-device scoring engine. Interprets JSON assessment configs so no network
 * call is required to know whether a worker passed.
 */
class AssessmentEngine {

    /** Scores a full submission. `arEvidence` maps AR taskId -> completed correctly. */
    fun evaluate(
        config: AssessmentConfig,
        answers: List<SubmittedAnswer>,
        arEvidence: Map<String, Boolean>
    ): AssessmentResult {
        val perQuestion = linkedMapOf<String, Boolean>()
        val answerByQuestion = answers.associateBy { it.questionId }

        var earned = 0
        var total = 0
        for (q in config.questions) {
            total += q.points
            val correct = when (q.type) {
                QuestionType.MC -> {
                    val a = answerByQuestion[q.id]
                    a != null && a.choice == q.answer
                }
                QuestionType.TRUE_FALSE -> {
                    val a = answerByQuestion[q.id]
                    a != null && a.boolValue == q.answerBool
                }
                QuestionType.SEQ -> {
                    val a = answerByQuestion[q.id]
                    a != null && a.sequence == q.sequence
                }
                QuestionType.MATCH -> {
                    val a = answerByQuestion[q.id]
                    a != null && a.mapping == q.pairs
                }
                QuestionType.AR_EVIDENCE -> {
                    q.arTaskId != null && arEvidence[q.arTaskId] == true
                }
            }
            perQuestion[q.id] = correct
            if (correct) earned += q.points
        }

        val pct = if (total == 0) 0 else (earned * 100) / total
        return AssessmentResult(
            moduleId = config.moduleId,
            score = pct,
            passed = pct >= config.passMark,
            correctCount = perQuestion.values.count { it },
            totalQuestions = config.questions.size,
            perQuestion = perQuestion,
            finishedAt = System.currentTimeMillis()
        )
    }
}