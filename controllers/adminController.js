import { User } from "../models/userModel.js";
import { Topic } from "../models/topicModel.js";
import { Progress } from "../models/progressModel.js";


export const allUsersProgress = async (req, res) => {
  try {
    const users = await User.find();
    const topics = await Topic.find();
    const totalQuestions = topics.reduce(
      (acc, topic) => acc + (topic.questions?.length || 0),
      0
    );

    if (totalQuestions === 0) {
      return res.status(200).json(users.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        progress: 0
      })));
    }

    const progressData = await Progress.find();

    const userProgressData = users.map((user) => {
      const userProgress = progressData.find(
        (p) => p.userId.toString() === user._id.toString()
      );

      // Count completed questions across all topics
      const totalCompleted = userProgress
        ? userProgress.topics.reduce(
            (acc, topic) => acc + (topic.doneQuestions?.length || 0),
            0
          )
        : 0;

      const percent = Math.round((totalCompleted / totalQuestions) * 100);

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        progress: isNaN(percent) ? 0 : percent,
      };
    });

    // Sort by progress descending
    userProgressData.sort((a, b) => b.progress - a.progress);

    res.status(200).json(userProgressData);
  } catch (error) {
    console.error("Error in allUsersProgress:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * @desc Fetch per-topic progress for a specific user
 * @route GET /api/admin/user/:id
 * @access Admin only
 */
export const totalProgressOfUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const topics = await Topic.find();
    const userProgress = await Progress.findOne({ userId: id });

    const topicProgress = topics.map((topic) => {
      const userTopic = userProgress?.topics.find(
        (t) => t.topicId.toString() === topic._id.toString()
      );

      const totalQuestions = topic.questions?.length || 0;
      const completed = userTopic?.doneQuestions?.length || 0;
      const percent = totalQuestions
        ? Math.round((completed / totalQuestions) * 100)
        : 0;

      return {
        topicId: topic._id,
        topicName: topic.topicName,
        totalQuestions,
        completed,
        percent,
      };
    });

    res.status(200).json({
      name: user.name,
      email: user.email,
      topicProgress,
    });
  } catch (error) {
    console.error("Error in totalProgressOfUsers:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
