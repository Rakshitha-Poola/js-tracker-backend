import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true
    },
    email:{
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password:{
        type: String,
        select:false
    },
    googleId: { 
        type: String, 
        unique: true 
    },
    role:{
        type: String,
        enum:["admin", "user"],
        default:"user",
        required:true
    }
}, {timestamps:true});

export const User = mongoose.model("User", userSchema)
