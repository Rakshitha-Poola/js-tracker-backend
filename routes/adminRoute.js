import express from 'express'
import { allUsersProgress, totalProgressOfUsers } from '../controllers/adminController.js'
import { checkAdmin } from '../middleware/checkAdmin.js'


const router = express.Router()

router.get("/allUsersProgress",checkAdmin, allUsersProgress)
router.get("/user/:id",checkAdmin, totalProgressOfUsers )

export default router