// controllers/topicController.js
import { Topic } from "../models/topicModel.js";
import { Progress } from "../models/progressModel.js";

// ✅ Add a topic
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

// ✅ Get all topics
export const getAllTopics = async (req, res) => {
  try {
    const topics = await Topic.find({});
    return res.status(200).json({ topics });
  } catch (error) {
    console.log("Error in getAllTopics", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// ✅ Get topic by name (with user progress merged)
export const getTopicById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { topicName } = req.params;
    if (!topicName) return res.status(400).json({ message: "Topic not found" });

    const topic = await Topic.findOne({ topicName }).lean();
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    // ✅ Ensure user progress exists
    let progress = await Progress.findOne({ userId });
    if (!progress) {
      progress = new Progress({ userId, topics: [] });
      await progress.save();
    }

    // Find progress for this topic
    const topicProgress =
      progress.topics.find((t) => t.topicId.toString() === topic._id.toString()) || {
        doneQuestions: [],
        bookmarkedQuestions: [],
        notes: [],
      };

    // ✅ Build questions with user progress
    const questions = topic.questions.map((q) => {
      const qId = q._id.toString();
      return {
        _id: q._id,
        problem: q.problem,
        URL: q.URL || "",
        URL2: q.URL2 || "",
        Done: topicProgress.doneQuestions.map(String).includes(qId),
        Bookmark: topicProgress.bookmarkedQuestions.map(String).includes(qId),
        Notes:
          topicProgress.notes.find((n) => n.questionId.toString() === qId)?.text || "",
      };
    });

    return res.status(200).json({ ...topic, questions });
  } catch (error) {
    console.error("Error in getTopicById:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};




// Update Done / Bookmark / Notes
export const updateFields = async (req, res) => {
  try {
    const userId = req.user._id;
    const { topicId, questionId } = req.params;
    const { field, value } = req.body;

    // Use the raw ObjectId types for database queries where possible
    const topicObjectId = topicId; 
    const questionObjectId = questionId;

    // --- Step 1: Ensure User Progress and Topic Progress Exist ---
    let progress = await Progress.findOne({ userId });
    
    // Create new progress document if it doesn't exist
    if (!progress) {
      progress = new Progress({ userId, topics: [] });
      await progress.save();
    }

    // Check if topic progress exists. If not, push the new topic structure.
    const topicProgressExists = progress.topics.some((t) => t.topicId.equals(topicObjectId));

    if (!topicProgressExists) {
      // Use $addToSet to safely ensure the topic is present, preventing duplicates
      // Mongoose handles the subdocument creation and insertion.
      await Progress.updateOne(
        { userId },
        {
          $addToSet: {
            topics: {
              topicId: topicObjectId,
              doneQuestions: [],
              bookmarkedQuestions: [],
              notes: [],
            },
          },
        }
      );
    }
    
    // Define the query to update the specific topic within the array
    const topicMatchQuery = {
      userId,
      "topics.topicId": topicObjectId,
    };
    
    // --- Step 2: Perform the Update Operation Directly in the Database ---
    let updateOperation = {};

    switch (field) {
      case "Done": {
        const arrayPath = "topics.$.doneQuestions";
        // value (boolean) determines add ($addToSet) or remove ($pull)
        if (value) {
          // Add questionId to doneQuestions array (only if it's not already there)
          updateOperation = { $addToSet: { [arrayPath]: questionObjectId } };
        } else {
          // Remove questionId from doneQuestions array
          updateOperation = { $pull: { [arrayPath]: questionObjectId } };
        }
        break;
      }
      case "Bookmark": {
        const arrayPath = "topics.$.bookmarkedQuestions";
        // value (boolean) determines add ($addToSet) or remove ($pull)
        if (value) {
          // Add questionId to bookmarkedQuestions array (only if it's not already there)
          updateOperation = { $addToSet: { [arrayPath]: questionObjectId } };
        } else {
          // Remove questionId from bookmarkedQuestions array
          updateOperation = { $pull: { [arrayPath]: questionObjectId } };
        }
        break;
      }
      case "Notes": {
        // For notes, we need to check if a note for this question exists and update it, or push a new one.
        // We use arrayFilters for conditional update, which is complex for direct push/set.
        // The safest approach is to first try to UPDATE an existing note (set text)
        // and if it doesn't exist (modifiedCount === 0), then PUSH a new one.

        // 1. Try to update an existing note for the question
        const result = await Progress.updateOne(
          topicMatchQuery,
          { $set: { "topics.$[topic].notes.$[note].text": value } },
          { 
            arrayFilters: [
              { "topic.topicId": topicObjectId }, 
              { "note.questionId": questionObjectId }
            ] 
          }
        );

        // 2. If no existing note was found/modified (result.modifiedCount === 0) AND the value is not empty, push a new note
        if (result.modifiedCount === 0 && value) {
          updateOperation = { 
            $push: { 
              "topics.$.notes": { questionId: questionObjectId, text: value } 
            } 
          };
        } else if (result.modifiedCount === 0 && !value) {
            // If the value is empty and no note was modified, this means the user is trying to clear a non-existent note. 
            // We can optionally remove the note entry if the value is being cleared/set to empty.
            updateOperation = { 
                $pull: { 
                    "topics.$.notes": { questionId: questionObjectId } 
                } 
            };
        }
        
        // If Notes logic completed, we skip the main updateOne call below, so we break here.
        break;
      }
      default:
        return res.status(400).json({ message: "Invalid field type" });
    }

    // Execute the main update for Done or Bookmark, or if Notes determined a push/pull is needed.
    if (Object.keys(updateOperation).length > 0) {
      await Progress.updateOne(topicMatchQuery, updateOperation);
    }


    // --- Step 3: Refetch the User Progress (Guaranteed to be the latest) ---
    // Refetch the document to ensure we have the most up-to-date state from the DB.
    progress = await Progress.findOne({ userId });
    
    // Find the now-guaranteed-to-exist topic progress object
    const updatedTopicProgress = progress.topics.find((t) => t.topicId.equals(topicObjectId));
    if (!updatedTopicProgress) {
        // Should not happen if Step 1 and 2 worked, but for robustness:
        return res.status(500).json({ message: "Failed to locate updated topic progress." });
    }

    // --- Step 4: Fetch Topic Data and Format Response ---

    const topicData = await Topic.findById(topicId).lean();
    if (!topicData) return res.status(404).json({ message: "Topic not found" });

    // Use the *refetched* updatedTopicProgress for accurate status
    const updatedQuestions = topicData.questions.map((q) => {
      const qId = q._id.toString();
      const noteObj = updatedTopicProgress.notes.find((n) => n.questionId.toString() === qId);

      // Use efficient Set lookups for large arrays, but for small arrays, includes is fine.
      // Ensure all IDs are compared as strings here.
      const doneIds = updatedTopicProgress.doneQuestions.map((id) => id.toString());
      const bookmarkIds = updatedTopicProgress.bookmarkedQuestions.map((id) => id.toString());

      return {
        ...q,
        Done: doneIds.includes(qId),
        Bookmark: bookmarkIds.includes(qId),
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


// ✅ Per-topic progress based on user progress
export const progressOfEachTopic = async (req, res) => {
  try {
    const userId = req.user._id;
    const topics = await Topic.find({}).lean();
    const progress = await Progress.findOne({ userId }).lean();

    const result = topics.map((topic) => {
      const topicProgress = progress?.topics.find(
        (t) => t.topicId.toString() === topic._id.toString()
      );
      const total = topic.questions.length;
      const done = topicProgress?.doneQuestions?.length || 0;
      const percentCompleted =
        total === 0 ? 0 : Math.round((done / total) * 100);

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

// ✅ Overall progress
export const totalProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const topics = await Topic.find({}).lean();
    const progress = await Progress.findOne({ userId }).lean();

    const totalQuestions = topics.reduce(
      (acc, curr) => acc + curr.questions.length,
      0
    );
    const totalCompleted = progress
      ? progress.topics.reduce(
          (acc, t) => acc + (t.doneQuestions?.length || 0),
          0
        )
      : 0;

    const totalPercent =
      totalQuestions > 0
        ? Math.round((totalCompleted / totalQuestions) * 100)
        : 0;

    return res.status(200).json({ message: "Total Percent", totalPercent });
  } catch (error) {
    console.log("Error in totalProgress", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ Bookmarked questions (per user)
export const bookmarkedQuestions = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch all topics
    const topics = await Topic.find({}).lean();

    // Fetch user's progress
    const progress = await Progress.findOne({ userId }).lean();

    if (!progress || !progress.topics) return res.status(200).json([]);

    const bookmarked = [];

    for (const topic of topics) {
      // Find user's progress for this topic
      const topicProgress = progress.topics.find(
        (t) => t.topicId.toString() === topic._id.toString()
      );

      if (!topicProgress || !topicProgress.bookmarkedQuestions) continue;

      const bookmarkedIds = topicProgress.bookmarkedQuestions.map(String);

      // Loop through questions
      topic.questions.forEach((q) => {
        if (bookmarkedIds.includes(q._id.toString())) {
          bookmarked.push({
            ...q,
            topicId: topic._id,
            topicName: topic.topicName,
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

