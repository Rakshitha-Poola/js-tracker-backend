// controllers/topicController.js
import { Topic } from "../models/topicModel.js";
import { Progress } from "../models/progressModel.js";

/**
 * Add a topic
 */
export const addTopic = async (req, res) => {
  try {
    const topicData = req.body;
    const newTopic = new Topic(topicData);
    await newTopic.save();
    res.status(200).json({ message: "Topic added successfully", topic: newTopic });
  } catch (error) {
    console.error("Error in addTopic:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get all topics with user progress merged
 */
export const getAllTopics = async (req, res) => {
  try {
    const userId = req.user?._id;
    const topics = await Topic.find({}).lean();

    if (!userId) return res.status(200).json({ topics });

    const userProgress = await Progress.findOne({ userId }).lean();

    if (!userProgress || !Array.isArray(userProgress.topics) || userProgress.topics.length === 0) {
      // Return topics with default progress
      const defaultTopics = topics.map(topic => ({
        ...topic,
        questions: topic.questions.map(q => ({
          ...q,
          Done: false,
          Bookmark: false,
          Notes: "",
        })),
      }));
      return res.status(200).json({ topics: defaultTopics });
    }

    const progressMap = new Map();
    userProgress.topics.forEach(t => progressMap.set(t.topicId.toString(), t));

    const mergedTopics = topics.map(topic => {
      const tp = progressMap.get(topic._id.toString());

      if (!tp) {
        return {
          ...topic,
          questions: topic.questions.map(q => ({
            ...q,
            Done: false,
            Bookmark: false,
            Notes: "",
          })),
        };
      }

      const doneSet = new Set(tp.doneQuestions?.map(String) || []);
      const bookmarkSet = new Set(tp.bookmarkedQuestions?.map(String) || []);
      const notesArr = tp.notes || [];

      const questions = topic.questions.map(q => {
        const qId = q._id.toString();
        const noteObj = notesArr.find(n => n.questionId?.toString() === qId);
        return {
          ...q,
          Done: doneSet.has(qId),
          Bookmark: bookmarkSet.has(qId),
          Notes: noteObj ? noteObj.text : "",
        };
      });

      return { ...topic, questions };
    });

    res.status(200).json({ topics: mergedTopics });
  } catch (error) {
    console.error("Error in getAllTopics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get topic by name with progress merged
 */
export const getTopicById = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { topicName } = req.params;
    if (!topicName) return res.status(400).json({ message: "Topic name required" });

    const topic = await Topic.findOne({ topicName }).lean();
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    let progress = null;
    if (userId) progress = await Progress.findOne({ userId });

    if (!progress) {
      progress = new Progress({ userId, topics: [] });
      await progress.save();
    }

    const topicProgress =
      progress.topics.find(t => t.topicId.toString() === topic._id.toString()) || {
        doneQuestions: [],
        bookmarkedQuestions: [],
        notes: [],
      };

    const doneSet = new Set(topicProgress.doneQuestions?.map(String) || []);
    const bookmarkSet = new Set(topicProgress.bookmarkedQuestions?.map(String) || []);
    const notesArr = topicProgress.notes || [];

    const questions = topic.questions.map(q => {
      const qId = q._id.toString();
      const noteObj = notesArr.find(n => n.questionId?.toString() === qId);
      return {
        ...q,
        Done: doneSet.has(qId),
        Bookmark: bookmarkSet.has(qId),
        Notes: noteObj ? noteObj.text : "",
      };
    });

    res.status(200).json({ ...topic, questions });
  } catch (error) {
    console.error("Error in getTopicById:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update Done / Bookmark / Notes for a question
 */
export const updateFields = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { topicId, questionId } = req.params;
    const { field, value } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!topicId || !questionId) return res.status(400).json({ message: "Missing IDs" });

    let progress = await Progress.findOne({ userId });
    if (!progress) {
      progress = new Progress({ userId, topics: [] });
      await progress.save();
    }

    const topicExists = progress.topics.some(t => t.topicId.toString() === topicId);
    if (!topicExists) {
      await Progress.updateOne(
        { userId },
        { $addToSet: { topics: { topicId, doneQuestions: [], bookmarkedQuestions: [], notes: [] } } }
      );
    }

    const topicMatch = { userId, "topics.topicId": topicId };

    if (field === "Done" || field === "Bookmark") {
      const path = `topics.$.${field === "Done" ? "doneQuestions" : "bookmarkedQuestions"}`;
      const updateOp = value ? { $addToSet: { [path]: questionId } } : { $pull: { [path]: questionId } };
      await Progress.updateOne(topicMatch, updateOp);
    } else if (field === "Notes") {
      // Try updating existing note
      const setResult = await Progress.updateOne(
        topicMatch,
        { $set: { "topics.$[topic].notes.$[note].text": value } },
        {
          arrayFilters: [{ "topic.topicId": topicId }, { "note.questionId": questionId }],
        }
      );

      if (setResult.modifiedCount === 0) {
        if (!value) {
          await Progress.updateOne(topicMatch, { $pull: { "topics.$.notes": { questionId } } });
        } else {
          await Progress.updateOne(topicMatch, { $push: { "topics.$.notes": { questionId, text: value } } });
        }
      }
    } else {
      return res.status(400).json({ message: "Invalid field" });
    }

    // Return updated topic
    progress = await Progress.findOne({ userId }).lean();
    const updatedTopicProgress = progress.topics.find(t => t.topicId.toString() === topicId);

    const topicData = await Topic.findById(topicId).lean();
    const doneSet = new Set(updatedTopicProgress.doneQuestions?.map(String) || []);
    const bookmarkSet = new Set(updatedTopicProgress.bookmarkedQuestions?.map(String) || []);
    const notesArr = updatedTopicProgress.notes || [];

    const updatedQuestions = topicData.questions.map(q => {
      const qId = q._id.toString();
      const noteObj = notesArr.find(n => n.questionId?.toString() === qId);
      return { ...q, Done: doneSet.has(qId), Bookmark: bookmarkSet.has(qId), Notes: noteObj ? noteObj.text : "" };
    });

    res.status(200).json({ message: "Progress updated successfully", topic: { ...topicData, questions: updatedQuestions } });
  } catch (error) {
    console.error("Error in updateFields:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get per-topic progress for user
 */
export const progressOfEachTopic = async (req, res) => {
  try {
    const userId = req.user?._id;
    const topics = await Topic.find({}).lean();
    const progress = await Progress.findOne({ userId }).lean();

    const result = topics.map(topic => {
      const tp = progress?.topics?.find(t => t.topicId.toString() === topic._id.toString());
      const total = topic.questions.length;
      const done = tp?.doneQuestions?.length || 0;
      const percentCompleted = total === 0 ? 0 : Math.round((done / total) * 100);
      return { topicName: topic.topicName, totalQuestions: total, completed: done, percentCompleted };
    });

    res.status(200).json({ message: "Progress sent", progress: result });
  } catch (error) {
    console.error("Error in progressOfEachTopic:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get overall total progress
 */
export const totalProgress = async (req, res) => {
  try {
    const userId = req.user?._id;
    const topics = await Topic.find({}).lean();
    const progress = await Progress.findOne({ userId }).lean();

    const totalQuestions = topics.reduce((acc, t) => acc + t.questions.length, 0);
    const totalDone = progress
      ? progress.topics.reduce((acc, t) => acc + (t.doneQuestions?.length || 0), 0)
      : 0;
    const totalPercent = totalQuestions ? Math.round((totalDone / totalQuestions) * 100) : 0;

    res.status(200).json({ message: "Total progress", totalPercent });
  } catch (error) {
    console.error("Error in totalProgress:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get all bookmarked questions
 */
export const bookmarkedQuestions = async (req, res) => {
  try {
    const userId = req.user?._id;
    const topics = await Topic.find({}).lean();
    const progress = await Progress.findOne({ userId }).lean();

    if (!progress?.topics?.length) return res.status(200).json([]);

    const result = [];

    const progressMap = new Map();
    progress.topics.forEach(tp => {
      progressMap.set(tp.topicId.toString(), {
        bookmarked: new Set(tp.bookmarkedQuestions?.map(String) || []),
        done: new Set(tp.doneQuestions?.map(String) || []),
        notes: tp.notes || [],
      });
    });

    topics.forEach(topic => {
      const tp = progressMap.get(topic._id.toString());
      if (!tp) return;

      topic.questions.forEach(q => {
        const qId = q._id.toString();
        if (tp.bookmarked.has(qId)) {
          const noteObj = tp.notes.find(n => n.questionId?.toString() === qId);
          result.push({
            ...q,
            topicId: topic._id,
            topicName: topic.topicName,
            Done: tp.done.has(qId),
            Bookmark: true,
            Notes: noteObj ? noteObj.text : "",
          });
        }
      });
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in bookmarkedQuestions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
