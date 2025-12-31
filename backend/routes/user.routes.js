
import multer from "multer";
import { acceptConnectionRequest, downloadProfile, findSearchUser, getAllUserBasedOnUsername, getMyConnectionRequest, getUserAndProfile, login, register, sendconnectionrequest, updateProfileData, updateUserProfile, uploadProfilePicture, whatAreMyConnection } from "../controllers/user.controller.js";
import {Router} from "express"
import { verifyToken } from "../middleware/auth.middleware.js"; 
import { Storage } from "../config/cloudinary.js";
import { deleteChat, deleteMessageForEveryone, deleteMessages, getMessages, sendMessage } from "../controllers/message.controller.js";
const router = Router();
const storage = multer.diskStorage({
    destination:(req, file , cb)=>{
        cb (null, 'uploads/')
    },
    filename:(req, file, cb )=>{
        cb (null, file.originalname)
    },

})
const upload = multer({storage:Storage})

router.route("/register").post(register);
router.route('/login').post(login)
router.route('/user/update_profile_picture').post(upload.single('profilePicture'),uploadProfilePicture)
router.route('/user/setting/user_update' ).post (updateUserProfile);
router.route('/get_user_and_profile').get(getUserAndProfile);
router.route('/update_profile').post (updateProfileData)
router.route('/user/findinguser').get(findSearchUser)
router.route('/user/download_resume').get(downloadProfile)
router.route('/user/send_connection_request').post(sendconnectionrequest)
router.route('/user/get_connection_request').get(getMyConnectionRequest)
router.route('/user/get_my_connections').get(whatAreMyConnection)
router.route('/user/is_accepted_connection_request').post(acceptConnectionRequest)

router.route('/user/get_user_based_on_username').get(getAllUserBasedOnUsername)
// router.route('/sendconnectionrequest').get()
// Import your authentication middleware

// Apply verifyToken BEFORE sendMessage
router.route('/user/send_message').post(
    upload.array('media', 5),  // Multer parses form data FIRST
    verifyToken,               // THEN verify token (can now read req.body.token)
    sendMessage                // THEN send message
);

router.route('/user/get_messages').get(
    verifyToken,               // Verify token
    getMessages                // Get messages
);

router.route('/user/delete_chat').post(
    verifyToken,               // Verify token
    deleteChat                 // Delete chat
);
// NEW: Delete specific messages (WhatsApp style)
router.route('/user/delete_messages').post(
    verifyToken,
    deleteMessages
);

// NEW: Delete message for everyone (only sender, within 1 hour)
router.route('/user/delete_message_for_everyone').post(
    verifyToken,
    deleteMessageForEveryone
);

export default router;


