import mongoose from "mongoose";

const ProgressSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"User",
        required: true,
        unique: true
    },
    topics:[
        {
            topicId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Topic",
                required: true,
            },
            doneQuestions:[
                {
                    type: mongoose.Schema.Types.ObjectId
                }
            ],
            bookmarkedQuestions: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                }
            ],
            notes:[
                {
                    questionId: {
                        type: mongoose.Schema.Types.ObjectId
                    },
                    text: String
                }
            ]
        }
    ]
})

export const Progress = mongoose.model("Progress", ProgressSchema)