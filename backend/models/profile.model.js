import mongoose from "mongoose";


const highlightSchema = new mongoose.Schema({
    title: {
        type: String,
        default: '',
        maxlength: 40
    },
    cover: {
        type: String,
        default: ''
    }
}, { _id: false })

const educationSchema = new mongoose.Schema({
    school: {
        type: String,
        default: ''
    },
    degree: {
        type: String,
        default: ''
    },
    feildStudy: {
        type: String,
        default: ''
    },

})



const workSchema = new mongoose.Schema({
    company: {
        type: String,
        default: ''
    },
    position: {
        type: String,
        default: ''
    },
    years: {
        type: String,
        default: ''
    }
})

const profileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        // Every profile fetch is Profile.findOne({ userId }) — this is the
        // single most-queried field in the whole app.
        index: true
    },
    bio: {
        type: String,
        default: ''
    },
    currentPost: {
        type: String,
        default: ''
    },
    pastWork: {
        type: [workSchema],
        default: []
    },
    education: {
        type: [educationSchema],
        default: []
    },
    skills: {
        type: [String],
        default: []
    },
    highlights: {
        type: [highlightSchema],
        default: []
    }
})

const Profile = mongoose.model('Profile', profileSchema);
export default Profile;
