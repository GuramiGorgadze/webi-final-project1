const express = require('express');
const router = express.Router();
const Blog = require('../models/blog');
const path = require("path");
const User = require("../models/user");


const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next()
    } else {
        console.log('No user found.');
        res.redirect('/login');
    }
}

router.get('/', requireAuth, async function (req, res, next) {
    const blogs = await Blog.find({});
    blogs.reverse()

    const user = req.session.user;

    res.render('blogs', {blogs, user});
});

router.get('/new', requireAuth, function (req, res, next) {
    const user = req.session.user;
    res.render('new_blog', {error: null, user});
});

router.post('/new', requireAuth, async function (req, res, next) {
    const sessionUser = req.session.user;
    const { title, description, content } = req.body;
    const image = req.files?.image;

    if (!title || !description || !content || !image) {
        return res.render("new_blog", { error: "All fields are required", user: sessionUser });
    }

    const uniqueSuffix = Date.now();
    const filename = `${sessionUser._id}_blog_${uniqueSuffix}_${image.name}`;

    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', filename);
    const relativePath = `/uploads/${filename}`;

    try {
        await image.mv(uploadPath);

        const currentDate = new Date();
        const currentDay = currentDate.getDate();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        const currentMonthString = months[currentMonth];
        const formatedDate = `${currentDay} ${currentMonthString} ${currentYear}`;

        const newBlogData = {
            id: String(Date.now()),
            title,
            description,
            content,
            picture: relativePath,
            author: req.session.user.email,
            date: new Date().toLocaleString(),
            formatedDate
        };

        const newBlog = new Blog(newBlogData);
        await newBlog.save();

        res.redirect('/blogs');
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while uploading the blog.");
    }
});

router.get('/:blogId', requireAuth, async function (req, res, next) {
    const user = req.session.user;
    const email = req.session.user.email;
    const {blogId} = req.params

    try {
        const blogs = await Blog.find();
        blogs.reverse()
        const blog = await Blog.findOne({id: blogId});
        res.render('blog', {user, email, blogs, blog});
    } catch (err) {
        console.log(err);
    }
});

router.post('/:blogId/newComment', requireAuth, async function (req, res, next) {
    const {blogId} = req.params;
    const {newComment} = req.body;

    try {
        const blog = await Blog.findOne({id: blogId});
        if (!blog) {
            throw new Error('Blog not found');
        }

        const comment = {
            id: String(Date.now()),
            content: newComment,
            author: req.session.user.name,
            authorPicture: req.session.user.profilePicture,
            replies: []
        };

        await Blog.updateOne(
            {id: blogId},
            {$push: {comments: comment}}
        );

    } catch (err) {
        console.log(err);
    }

    res.redirect(`/blogs/${blogId}`);
});

router.post('/:blogId/comment/:commentId/like', requireAuth, async function (req, res, next) {
    const {blogId, commentId} = req.params;
    const email = req.session.user.email;

    try {
        // First, find the blog and check if the user has already liked the comment
        const blog = await Blog.findOne(
            {id: blogId, 'comments.id': commentId}
        );

        const comment = blog.comments.find(c => c.id === commentId);
        const hasLiked = comment.likes && comment.likes.includes(email);

        // If user has already liked, remove the like; otherwise add it
        const updateOperation = hasLiked
            ? { $pull: { 'comments.$.likes': email } }
            : { $addToSet: { 'comments.$.likes': email } };

        const result = await Blog.updateOne(
            {id: blogId, 'comments.id': commentId},
            updateOperation
        );
        console.log(result);
    } catch (err) {
        console.log(err);
    }

    res.redirect(`/blogs/${blogId}`);
});

router.post('/:blogId/comment/:commentId/reply', requireAuth, async function (req, res, next) {
    const {blogId, commentId} = req.params;
    const {replyContent} = req.body;

    try {
        const reply = {
            content: replyContent,
            author: req.session.user.email,
            authorPicture: req.session.user.profilePicture
        };

        // Using $push to add the reply to the specific comment's replies array
        const res = await Blog.updateOne(
            {
                'id': blogId,
                'comments.id': commentId
            },
            {
                $push: {
                    'comments.$.replies': reply
                }
            }
        );

        console.log(res);
    } catch (err) {
        console.log(err);
    }

    res.redirect(`/blogs/${blogId}`);
});

module.exports = router;
