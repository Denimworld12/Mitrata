
import multer from "multer";
import { acceptConnectionRequest, downloadProfile, findSearchUser, getAllUserBasedOnUsername, getMyConnectionRequest, getUserAndProfile, login, register, sendconnectionrequest, updateProfileData, updateUserProfile, uploadProfilePicture, whatAreMyConnection } from "../controllers/user.controller.js";
import {Router} from "express"

const router = Router();
const storage = multer.diskStorage({
    destination:(req, file , cb)=>{
        cb (null, 'uploads/')
    },
    filename:(req, file, cb )=>{
        cb (null, file.originalname)
    },

})
const upload = multer({storage:storage})

router.route("/register").post(register);
router.route('/login').post(login)
router.route('/update_profile_picture').post(upload.single('profile_picture'),uploadProfilePicture)
router.route('/user_update' ).post (updateUserProfile);
router.route('/get_user_and_profile').get(getUserAndProfile);
router.route('/update_profile').post (updateProfileData)
router.route('/user/findinguser').get(findSearchUser)
router.route('/user/download_resume').get(downloadProfile)
router.route('/user/send_connection_request').post(sendconnectionrequest)
router.route('/user/get_connection_request').get(getMyConnectionRequest)
router.route('/user/get_my_connections').get(whatAreMyConnection)
router.route('/user/is_accepted_connection_request').get(acceptConnectionRequest)

router.route('/user/get_user_based_on_username').get(getAllUserBasedOnUsername)
// router.route('/sendconnectionrequest').get()
export default router;
