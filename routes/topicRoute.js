import { addTopic, bookmarkedQuestions, getAllTopics, getTopicById, progressOfEachTopic, totalProgress, updateFields } from '../controllers/topicController.js';
import express from 'express'
import { checkUser } from '../middleware/checkUser.js';

const router = express.Router();

router.post('/addTopics', addTopic)
router.get("/get-allTopics",checkUser, getAllTopics)
router.get("/get-topic/:topicName",checkUser, getTopicById)
router.patch("/:topicId/questions/:questionId",checkUser, updateFields)
router.get("/each-topic/progress",checkUser, progressOfEachTopic)
router.get("/all-topics/progress", checkUser, totalProgress)
router.get("/bookmarked", checkUser, bookmarkedQuestions)
export default router