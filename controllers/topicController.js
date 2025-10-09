import { Topic } from "../models/QuestionsModel.js";


export const addTopic = async(req, res) =>{
    try {
        const topic = req.body;
        const addTopic = new Topic(topic)
        await addTopic.save();
        res.status(200).json({message:"Topic added successfuly", addTopic})
    } catch (error) {
        console.log("Error in addTopic", error)
        res.status(500).json({message:"Internal server error"})
    }
    

}

export const getAllTopics = async(req, res) => {
    try {
        const topics = await Topic.find({});
        return res.status(200).json({topics})
    } catch (error) {
        console.log("Error in getAllTopics", error)
    }
}

export const getTopicById = async(req, res) => {
    try {
        const {topicName} = req.params;
        
    if(!topicName){
        return res.status(400).json({message:"Topic not found"})
    }

    const topic = await Topic.findOne({topicName})
    if(!topic){
        return res.status(400).json({message:"Topic not found"})
    }
    res.status(200).json(topic)

    } catch (error) {
        console.log("Error in getTopicById", error)
        res.status(500).json({message:"Internal server error"})
    }
}

export const updateFields = async(req, res) => {
    try {
    const { topicId, questionId } = req.params;
    const { field, value } = req.body;
    const topic = await Topic.findOne({position: topicId})
    
    
    topic.questions[questionId][field] = value;
    topic.doneQuestions = topic.questions.filter(q => q.Done).length;
    await topic.save();
    return res.status(200).json({message:"Updated successfully", topic})
   
  } catch (error) {
    console.log("Error in updateFields", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export const progressOfEachTopic = async(req, res) => {
    try {
        const topic = await Topic.find()
    const progress = topic.map(each => {
        const total = each.questions.length;
        const done = each.questions.filter(q => q.Done).length;
        const percentCompleted = total===0 ? 0 : Math.round((done/total)*100);
        return{
            topicName: each.topicName,
            totalQuestions: total,
            completed: done,
            percentCompleted: percentCompleted
        }
    })

    res.status(200).json({message:"Progress sent", progress})
    } catch (error) {
        console.log("Error in progressOfEachTopic", error)
        return res.status(500).json({message: "Internal server error"})
    }
    

}

export const totalProgress = async(req, res) => {
   try {
    const topic = await Topic.find({})
     const totalQuestions = topic.reduce((acc, curr) => acc + curr.questions.length, 0)
    const totalCompleted = topic.reduce((acc, curr) => acc + curr.questions.filter((each) => each.Done).length, 0)
    const totalPercent = totalQuestions > 0 ? Math.round((totalCompleted/totalQuestions)*100) : 0;
    return res.status(200).json({message:"Total Percent", totalPercent})

   } catch (error) {
        console.log("Error in total Progress", error)
        return res.status(500).json({message: "Internal server error"})
   }
}

export const bookmarkedQuestions = async(req, res) => {
    try {
        const topics = await Topic.find({});
        const bookmarked = []

        topics.forEach((topic) => {
            topic.questions.forEach((q, idx) => {
                if(q.Bookmark){
                    bookmarked.push({
                        ...q.toObject(),
                        topicId: topic.position,
                        questionId: idx,
                        topicName: topic.topicName,
                    })
                }
            })
        })
    return res.status(200).json(bookmarked)
    } catch (error) {
        console.log("Error in bookmarkedQuestions", error)
    }
}