import { User } from "../models/userModel.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { OAuth2Client } from "google-auth-library";


dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
export const register = async(req, res) => {
    try {
        const {name, email, password} = req.body;

    if(!name || !email || !password){
        return res.status(400).json({message:"All fields are required*"})
    }

    const user = await User.findOne({email})
    if(user){
        return res.status(400).json({message:"User already exists"})
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser =  new User({name, email,password:hashedPassword })
    await newUser.save();

    const token = await jwt.sign({email},process.env.SECRET_KEY, {expiresIn:'7d'} )
    console.log("User registered successfully")
    return res.status(200).json({message:"User registerd successfully", token, user:newUser})
    } catch (error) {
        console.log("Error in register controller", error)
        return res.status(500).json({message:"Internal server error"})
    }
}

export const login = async(req, res) => {
    try {
        const {email, password} = req.body
    if(!email || !password){
        return res.status(400).json({message:"All fields are required*"})
    }
    const user = await User.findOne({email}).select('+password');
    const comparePassword = await bcrypt.compare(password, user.password)
    if(!user || !comparePassword){
        return res.status(400).json({message:"Invalid email or password"})
    }

    const token = await jwt.sign({email}, process.env.SECRET_KEY, {expiresIn:'7d'})
    console.log("Login successfull")
    return res.status(200).json({message:"Login successfull", token})
    } catch (error) {
        console.log("Error in Login controller", error)
        return res.status(500).json({message:"Internal server error"})
    }
}

export const google = async(req, res) => {
    try {
        const {token} = req.body;
        const ticket = await client.verifyIdToken({
            idToken:token,
            audience:process.env.GOOGLE_CLIENT_ID
        })

        const payload = ticket.getPayload();
        const {email, name, sub} = payload

        let user = await User.findOne({email})
        if(!user){
            user = await User.create({
                name, email, googleId:sub
            });
        }

        const newToken = await jwt.sign({email: user.email}, process.env.SECRET_KEY, {expiresIn:'7d'})
        console.log(newToken, user)
        return res.status(200).json({message:"User logined successfully", token: newToken, user})
    } catch (error) {
        console.log("Error in google Controller", error)
        return res.status(500).json({message:"Internal server error"})
    }
}
