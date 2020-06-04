const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');

const io = require('../socket');
const User = require('../models/user');
const Post = require('../models/post');
const FeedController = require('../controllers/feed');
const { dbConfigTest } = require('../db-config');

const MOCK_USER_ID = '5c0f66b979af55031b34728a';

const MOCK_USER = {
  email: 'test@test.com',
  password: 'testage',
  name: 'Test',
  posts: [],
  _id: MOCK_USER_ID,
};

describe('Feed Controller - getStatus', () => {

  before((done) => {

    mongoose.connect(dbConfigTest, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(result => User.deleteMany({}))
      .then(() => {
        const user = new User(MOCK_USER);
        return user.save();
      })
      .then(() => done());
  });

  it('should send a response with a valid user status for an existing user', (done) => {
    const req = { userId: MOCK_USER_ID };

    // mock for the res.status(200).json...
    const res = {
      statusCode: 500,
      userStatus: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.userStatus = data.status;
      }
    };

    FeedController.getStatus(req, res, () => {}).then(() => {
      expect(res.statusCode).to.be.equal(200);
      expect(res.userStatus).to.be.equal('I am new');
      done();
    })

  })

  after((done) => {
    User.deleteMany({})
      .then(() => {
      return mongoose.disconnect();
    }).then(() => done())
  });

});

describe('Feed Controller - createPost', () => {

  before((done) => {
    mongoose.connect(dbConfigTest, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(result => User.deleteMany({}))
      .then(() => {
        const user = new User(MOCK_USER);
        return user.save();
      })
      .then(() => done());
  });

  it('should add a created post to thes posts of the creator', (done) => {

    const req = {
      body: {
       title: 'Test title',
       content: 'Test content',
      },
      file: {
        path: 'abc',
      },
      userId: MOCK_USER_ID,
    };

    const res = {
      status: function() {
        return this;
      },
      json: function() {},
    };


    const mockIo = {
      emit: function(arg1, arg2) {}
    };

    sinon.stub(io, 'getIO');

    io.getIO.returns(mockIo);

    FeedController.createPost(req, res, () => {})
      .then((savedUser) => {
        expect(savedUser).to.have.property('posts');
        expect(savedUser.posts).to.have.length(1);
        done();
      });
  });

  after((done) => {
    io.getIO.restore();
    User.deleteMany({})
      .then(() => Post.deleteMany({}))
      .then(() => mongoose.disconnect())
      .then(() => done())
  });
});
