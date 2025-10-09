import { User } from "../models/userModel.js"
import { Topic } from "../models/QuestionsModel.js"
export const allUsersProgress = async(req, res) => {
    try {
        const user = await User.find();
        const topics = await Topic.find();

        const userProgressData = user.map((each) => {
            const totalQuestions = topics.reduce((acc, curr) => acc + curr.questions.length, 0);
            const totalCompleted = topics.reduce((acc, curr) => acc + curr.doneQuestions, 0)
            const percent = totalQuestions? Math.round((totalCompleted/totalQuestions)*100) : 0;
            return {
                _id: each._id,
                name: each.name,
                email: each.email,
                progress: percent
            }
    })
    userProgressData.sort((a, b) => b.progress - a.progress)
    res.json(userProgressData);
    } catch (error) {
        console.log("Error in admin controller",error)
        res.status(500).json({message: "Internal server error"})
    }
}

export const totalProgressOfUsers = async(req, res) => {
    try {
        const {id} = req.params;

        const user = await User.findById(id);
        const topics = await Topic.find();

        if(!user){
            return res.status(400).json({message:"User not found"})
        }

        const topicProgress = topics.map((each) => {
            const totalQuestions = each.questions.length;
            const doneQuestions = each.doneQuestions;
            const percent = totalQuestions ? Math.round((doneQuestions/totalQuestions)*100) : 0;
            return{
                topicId: each._id,
                topicName: each.topicName,
                totalQuestions: totalQuestions,
                completed: doneQuestions,
                percent,
            }
        })

        res.status(200).json({name: user.name, email: user.email, topicProgress})
    } catch (error) {
        console.log("Error in Admin controller", error)
        res.status(500).json({message: "Internal server error"})
    }
}