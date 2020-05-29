const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');

const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  let totalItems;

  Post.find().countDocuments()
    .then(count => {
      totalItems = count;
      return Post
        .find()
        .populate('creator', 'name _id')
        .skip((currentPage - 1) * perPage)
        .limit(perPage);
    })
    .then(posts => {
      res.status(200).json({
        message: 'Posts fetched.',
        posts,
        totalItems,
      })
    })
    .catch(err => {
      if (!err.status) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.createPost = (req, res, next) => {
  // validate
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    error.errorList = errors.array();

    // throwing error will exit current function and reach next error handling or middlware
    // next if we are in an async block
    throw error;
  }

  if (!req.file) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }

  const { title, content } = req.body;
  const imageUrl = req.file.path.replace(/\\/g, '/'); // for windows

  // create post in db
  const post = new Post({
    title,
    content,
    imageUrl,
    creator: req.userId,
  });

  let creator;
  let postSaved;

  post.save()
    .then(result => {
      postSaved = result._doc;
      return User.findById(req.userId);
    })
    .then(user => {
      creator = user;
      // add post to the user's posts
      user.posts.push(post);
      return user.save();
    })
    .then(result => {
      // response,
      res.status(201).json({
        message: 'Post created successfully',
        post: {
          ...postSaved,
          // populate by hand (didn't check the FE, still errors when adding the new to list)
          creator: {
            _id: creator._id,
            name: creator.name,
          }
        },
      });
    })
    .catch(err => {
      if (!err.status) {
        err.statusCode = 500;
      }
      next(err);
    });

};

exports.getPost = (req, res, next) => {
  const postId = req.params.postId;

  Post.findById(postId)
    .populate('creator', 'name _id')
    .then(post => {
      if (!post) {
        const error = new Error('Could not find the requested post.');
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({
        message: 'Post fetched.',
        post: post,
      })
    })
    .catch(err => {
      if (!err.status) {
        err.statusCode = 500;
      }
      next(err);
  });
};

exports.updatePost = (req, res, next) => {
  const postId = req.params.postId;

  // validate
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    error.errorList = errors.array();
    throw error;
  }

  const { title, content } = req.body;
  let imageUrl = req.body.image;

  // if new file, replace
  if (req.file) {
    imageUrl = req.file.path;
  }

  if (!imageUrl) {
    const error = new Error('No file picked.');
    error.statusCode = 422;
    throw error;
  }

  Post.findById(postId)
    .then(post => {
      if (!post) {
        const error = new Error('Could not find the requested post.');
        error.statusCode = 404;
        throw error;
      }

      if (post.creator.toString() !== req.userId) {
        const error = new Error('Not authorized to edit this post.');
        error.statusCode = 403;
        throw error;
      }

      // if new image, delete old
      if (imageUrl !== post.imageUrl) {
        clearImage(post.imageUrl);
      }
      post.title = title;
      post.content = content;
      post.imageUrl = imageUrl;
      return post.save();
    })
    .then(result => {
      res.status(200).json({
        message: 'Post updated',
        post: result,
      });
    })
    .catch(err => {
      if (!err.status) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.deletePost = (req, res, next) => {
  const postId = req.params.postId;

  Post.findById(postId)
    .then(post => {
      if (!post) {
        const error = new Error('Could not find the requested post.');
        error.statusCode = 404;
        throw error;
      }

      if (post.creator.toString() !== req.userId) {
        console.log('post.creator', post.creator);
        console.log('req.userId', req.userId);
        const error = new Error('Not authorized to delete this post.');
        error.statusCode = 403;
        throw error;
      }

      // check logged in user
      clearImage(post.imageUrl);
      return Post.findByIdAndRemove(postId);
    })
    .then(result => {
      return User.findById(req.userId);
    })
    .then(user => {
      // remove post from user posts too
      user.posts.pull(postId);
      return user.save();
    })
    .then(result => {
      res.status(200).json({
        message: 'Deleted post'
      })
    })
    .catch(err => {
      if (!err.status) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getStatus = (req, res, next) => {
  const userId = req.userId;
  User.findById(userId)
    .then(user => {
      res.status(200).json({
        status: user.status,
      })
    })
    .catch(err => {
      if (!err.status) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.updateStatus = (req, res, next) => {
  console.log('req.body', req.body)
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    error.errorList = errors.array();
    throw error;
  }

  const userId = req.userId;
  const newStatus = req.body.newStatus;

  User.findById(userId)
    .then(user => {
      user.status = newStatus;
      return user.save();
    })
    .then(result => {
      res.status(201).json({
        status: newStatus,
      })
    })
    .catch(err => {
      if (!err.status) {
        err.statusCode = 500;
      }
      next(err);
    });
};

const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, err => console.error(err));
};
