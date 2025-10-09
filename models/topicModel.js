import mongoose from "mongoose";

const QuestionsSchema = new mongoose.Schema({
    problem:{
        type:String,
        required: true
    },
    URL:{
        type:String,
    },
    URL2:{
        type:String
    }
})

const TopicSchema = new mongoose.Schema({
    topicName:{
        type: String,
        requird: true
    },
    position:{
        type: Number,
        required: true,
    },
    questions:[QuestionsSchema]
})


export const Topic = mongoose.model("Topic", TopicSchema)