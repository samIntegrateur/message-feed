const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');

const authMiddleware = require('../middleware/is-auth');

describe('Auth middleware', () => {

  it('should throw an error if no authorization header is present', () => {
    const req = {
      get: (headerName) => {
        return null;
      }
    };

    expect(authMiddleware.bind(this, req, {}, () => {})).to.throw('No token provided!');
  });

  it('should throw an error if no authorization header is only one string', () => {
    const req = {
      get: (headerName) => {
        return 'xyz';
      }
    };

    expect(authMiddleware.bind(this, req, {}, () => {})).to.throw('No token provided!');
  });

  it('should throw an error if the token cannot be verified', () => {
    const req = {
      get: (headerName) => {
        return 'Bearer invalidtoken';
      }
    };

    expect(authMiddleware.bind(this, req, {}, () => {})).to.throw();
  });

  it('should yield a userId after decoding the token', () => {
    const req = {
      get: (headerName) => {
        return 'Bearer validtoken';
      }
    };

    sinon.stub(jwt, 'verify');

    jwt.verify.returns({ userId: 'abc' });

    authMiddleware(req, {}, () => {});

    expect(req).to.have.property('userId');
    expect(req).to.have.property('userId', 'abc');
    expect(jwt.verify.called).to.be.true;

    jwt.verify.restore();
  });

});

