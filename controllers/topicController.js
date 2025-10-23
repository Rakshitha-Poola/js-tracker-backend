// controllers/topicController.js
import { Topic } from "../models/topicModel.js";
import { Progress } from "../models/progressModel.js";

/**
 * ✅ Add a topic
 */
export const addTopic = async (req, res) => {
  try {
    const topic = req.body;
    const addTopic = new Topic(topic);
    await addTopic.save();
    res.status(200).json({ message: "Topic added successfully", addTopic });
  } catch (error) {
    console.log("Error in addTopic", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * ✅ Get all topics (merged with user progress: Done, Bookmark, Notes)
 *
 * - If a user has no progress doc yet, returns topics as-is.
 * - Otherwise, merges the user's progress (progress.topics) into each topic.questions
 */
export const getAllTopics = async (req, res) => {
  try {
    const userId = req.user?._id; // may be undefined if route not protected; ideally auth middleware ensures it
    // Fetch all topics
    const topics = await Topic.find({}).lean();

    // If no userId (unexpected), just return topics
    if (!userId) {
      return res.status(200).json({ topics });
    }

    // Fetch user's progress doc (may be null)
    const userProgress = await Progress.findOne({ userId }).lean();

    // If no progress, return topics as-is
    if (!userProgress || !Array.isArray(userProgress.topics) || userProgress.topics.length === 0) {
      return res.status(200).json({ topics });
    }

    // Build a map for faster lookups: topicId -> topicProgress
    const progressMap = new Map();
    for (const t of userProgress.topics) {
      progressMap.set(t.topicId.toString(), t);
    }

    // Merge progress into topics
    const mergedTopics = topics.map((topic) => {
      const tp = progressMap.get(topic._id.toString());

      // If no topic progress, just map questions to default progress fields
      if (!tp) {
        const defaultQuestions = topic.questions.map((q) => ({
          ...q,
          Done: false,
          Bookmark: false,
          Notes: "",
        }));
        return { ...topic, questions: defaultQuestions };
      }

      // Prepare sets for quick lookup
      const doneSet = new Set((tp.doneQuestions || []).map(String));
      const bookmarkSet = new Set((tp.bookmarkedQuestions || []).map(String));
      const notesArr = tp.notes || [];

      const questionsWithProgress = topic.questions.map((q) => {
        const qId = q._id.toString();
        const noteObj = notesArr.find((n) => n.questionId?.toString() === qId);

        return {
          ...q,
          Done: doneSet.has(qId),
          Bookmark: bookmarkSet.has(qId),
          Notes: noteObj ? noteObj.text : "",
        };
      });

      return { ...topic, questions: questionsWithProgress };
    });

    return res.status(200).json({ topics: mergedTopics });
  } catch (error) {
    console.error("Error in getAllTopics", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * ✅ Get topic by name (with user progress merged)
 *
 * Note: your routes may call this as /topic/get-topic/:topicName
 */
export const getTopicById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { topicName } = req.params;
    if (!topicName) return res.status(400).json({ message: "Topic not found" });

    const topic = await Topic.findOne({ topicName }).lean();
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    // Ensure user progress exists (create if missing)
    let progress = await Progress.findOne({ userId });
    if (!progress) {
      progress = new Progress({ userId, topics: [] });
      await progress.save();
    }

    // Find progress for this topic (if any)
    const topicProgress =
      progress.topics.find((t) => t.topicId.toString() === topic._id.toString()) || {
        doneQuestions: [],
        bookmarkedQuestions: [],
        notes: [],
      };

    const doneSet = new Set((topicProgress.doneQuestions || []).map(String));
    const bookmarkSet = new Set((topicProgress.bookmarkedQuestions || []).map(String));
    const notesArr = topicProgress.notes || [];

    const questions = topic.questions.map((q) => {
      const qId = q._id.toString();
      return {
        _id: q._id,
        problem: q.problem,
        URL: q.URL || "",
        URL2: q.URL2 || "",
        Done: doneSet.has(qId),
        Bookmark: bookmarkSet.has(qId),
        Notes: notesArr.find((n) => n.questionId?.toString() === qId)?.text || "",
      };
    });

    return res.status(200).json({ ...topic, questions });
  } catch (error) {
    console.error("Error in getTopicById:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * ✅ Update Done / Bookmark / Notes
 *
 * Route: PATCH /topic/:topicId/questions/:questionId
 * Body: { field: "Done" | "Bookmark" | "Notes", value: boolean | string }
 */
export const updateFields = async (req, res) => {
  try {
    const userId = req.user._id;
    const { topicId, questionId } = req.params;
    const { field, value } = req.body;

    // Defensive checks
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!topicId || !questionId) return res.status(400).json({ message: "Missing ids" });

    // --- Ensure Progress document exists ---
    let progress = await Progress.findOne({ userId });
    if (!progress) {
      progress = new Progress({ userId, topics: [] });
      await progress.save();
    }

    // Ensure topic entry exists inside progress.topics
    const topicExists = progress.topics.some((t) => t.topicId.toString() === topicId.toString());
    if (!topicExists) {
      await Progress.updateOne(
        { userId },
        {
          $addToSet: {
            topics: {
              topicId,
              doneQuestions: [],
              bookmarkedQuestions: [],
              notes: [],
            },
          },
        }
      );
    }

    // Query that targets the correct topic subdocument
    const topicMatchQuery = { userId, "topics.topicId": topicId };

    // Build update operation
    let updateOperation = {};

    if (field === "Done") {
      const path = "topics.$.doneQuestions";
      updateOperation = value ? { $addToSet: { [path]: questionId } } : { $pull: { [path]: questionId } };
      await Progress.updateOne(topicMatchQuery, updateOperation);
    } else if (field === "Bookmark") {
      const path = "topics.$.bookmarkedQuestions";
      updateOperation = value ? { $addToSet: { [path]: questionId } } : { $pull: { [path]: questionId } };
      await Progress.updateOne(topicMatchQuery, updateOperation);
    } else if (field === "Notes") {
      // Try to update existing note
      const setResult = await Progress.updateOne(
        topicMatchQuery,
        { $set: { "topics.$[topic].notes.$[note].text": value } },
        {
          arrayFilters: [{ "topic.topicId": topicId }, { "note.questionId": questionId }],
        }
      );

      if (setResult.modifiedCount === 0) {
        // if value is empty -> remove any existing note for the question
        if (!value) {
          await Progress.updateOne(topicMatchQuery, {
            $pull: { "topics.$.notes": { questionId } },
          });
        } else {
          // push new note
          await Progress.updateOne(topicMatchQuery, {
            $push: { "topics.$.notes": { questionId, text: value } },
          });
        }
      }
    } else {
      return res.status(400).json({ message: "Invalid field type" });
    }

    // Refetch up-to-date progress for this user and topic
    progress = await Progress.findOne({ userId }).lean();
    const updatedTopicProgress = progress.topics.find((t) => t.topicId.toString() === topicId.toString());
    if (!updatedTopicProgress) {
      return res.status(500).json({ message: "Failed to locate updated topic progress." });
    }

    // Fetch topic and build response questions with current progress
    const topicData = await Topic.findById(topicId).lean();
    if (!topicData) return res.status(404).json({ message: "Topic not found" });

    const doneSet = new Set((updatedTopicProgress.doneQuestions || []).map(String));
    const bookmarkSet = new Set((updatedTopicProgress.bookmarkedQuestions || []).map(String));
    const notesArr = updatedTopicProgress.notes || [];

    const updatedQuestions = topicData.questions.map((q) => {
      const qId = q._id.toString();
      const noteObj = notesArr.find((n) => n.questionId?.toString() === qId);
      return {
        ...q,
        Done: doneSet.has(qId),
        Bookmark: bookmarkSet.has(qId),
        Notes: noteObj ? noteObj.text : "",
      };
    });

    return res.status(200).json({
      message: "Progress updated successfully",
      topic: { ...topicData, questions: updatedQuestions },
    });
  } catch (err) {
    console.error("Error in updateFields:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * ✅ Per-topic progress based on user progress
 */
export const progressOfEachTopic = async (req, res) => {
  try {
    const userId = req.user._id;
    const topics = await Topic.find({}).lean();
    const progress = await Progress.findOne({ userId }).lean();

    const result = topics.map((topic) => {
      const topicProgress = progress?.topics?.find((t) => t.topicId.toString() === topic._id.toString());
      const total = topic.questions.length;
      const done = topicProgress?.doneQuestions?.length || 0;
      const percentCompleted = total === 0 ? 0 : Math.round((done / total) * 100);

      return {
        topicName: topic.topicName,
        totalQuestions: total,
        completed: done,
        percentCompleted,
      };
    });

    res.status(200).json({ message: "Progress sent", progress: result });
  } catch (error) {
    console.log("Error in progressOfEachTopic", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * ✅ Overall total progress
 */
export const totalProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const topics = await Topic.find({}).lean();
    const progress = await Progress.findOne({ userId }).lean();

    const totalQuestions = topics.reduce((acc, curr) => acc + curr.questions.length, 0);
    const totalCompleted = progress
      ? progress.topics.reduce((acc, t) => acc + (t.doneQuestions?.length || 0), 0)
      : 0;

    const totalPercent = totalQuestions > 0 ? Math.round((totalCompleted / totalQuestions) * 100) : 0;

    return res.status(200).json({ message: "Total Percent", totalPercent });
  } catch (error) {
    console.log("Error in totalProgress", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * ✅ Bookmarked questions (per user)
 *
 * Returns an array of question objects augmented with topicId and topicName
 */
export const bookmarkedQuestions = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch all topics & user progress
    const topics = await Topic.find({}).lean();
    const progress = await Progress.findOne({ userId }).lean();

    if (!progress || !Array.isArray(progress.topics) || progress.topics.length === 0) {
      return res.status(200).json([]);
    }

    const bookmarked = [];

    // Build map of topicId -> bookmarked question ids set
    const progressMap = new Map();
    for (const tp of progress.topics) {
      progressMap.set(tp.topicId.toString(), {
        bookmarked: new Set((tp.bookmarkedQuestions || []).map(String)),
        notes: tp.notes || [],
        done: new Set((tp.doneQuestions || []).map(String)),
      });
    }

    for (const topic of topics) {
      const tp = progressMap.get(topic._id.toString());
      if (!tp) continue;

      topic.questions.forEach((q) => {
        const qId = q._id.toString();
        if (tp.bookmarked.has(qId)) {
          bookmarked.push({
            ...q,
            topicId: topic._id,
            topicName: topic.topicName,
            Done: tp.done.has(qId),
            Bookmark: true,
            Notes: tp.notes.find((n) => n.questionId?.toString() === qId)?.text || "",
          });
        }
      });
    }

    return res.status(200).json(bookmarked);
  } catch (error) {
    console.error("Error in bookmarkedQuestions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
