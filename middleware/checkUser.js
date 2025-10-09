import jwt from "jsonwebtoken"
import dotenv from 'dotenv'
import { User } from "../models/userModel.js"

dotenv.config()

export const checkUser = async(req, res, next) => {
    try {
        const token = req?.headers?.authorization?.split(" ")[1]
    if(!token){
        return res.status(400).json({message:"User unauthorized"})
    }
    const decoded = await jwt.verify(token, process.env.SECRET_KEY)
    const email = decoded.email
    const user = await User.findOne({email})
    if(!user){
        return res.status(400).json({message:"User not found"})
    }

    next()
    } catch (error) {
        console.log("Error in checkUser", error)
        return res.status(500).json({message:"Internal server error"})
    }
}