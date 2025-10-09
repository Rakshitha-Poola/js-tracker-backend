import mongoose from "mongoose";

const QuestionsSchema = new mongoose.Schema({
    Topic:{
        type:String,
        required:true
    },
    Problem:{
        type:String,
        required:true
    },
    Done:{
        type:Boolean,
        default:false
    },
    Bookmark:{
        type:Boolean,
        default:false
    },
    Notes:{
        type:String,
        default:""
    },
    URL:{
        type:String
    },
    URL2:{
        type:String
    }


})

const TopicSchema = new mongoose.Schema({
    topicName:{
        type:String,
        required:true
    },
    position:{
        type:Number,
        required:true
    },
    started:{
        type:Boolean,
        default:false
    },
    doneQuestions:{
        type:Number,
        default:0
    },
    questions:[QuestionsSchema]
})

export const Topic = mongoose.model("Topic", TopicSchema)