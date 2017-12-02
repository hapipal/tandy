# Tandy

#### Auto-generated, RESTful, CRUDdy route handlers
to be used with [hapi](https://github.com/hapijs/hapi) and its [Objection](https://github.com/Vincit/objection.js/) plugin, [Schwifty](https://github.com/BigRoomStudios/Schwifty/).

A clone of the [Waterline](https://github.com/balderdashy/waterline)-based tool, [Bedwetter](https://github.com/devinivy/bedwetter).

---

## What it does
Tandy registers route handlers based upon the `method` and `path` of your route.  It turns them into RESTful API endpoints that automatically interact with the model defined using Schwifty.  The route handler is based on one of eight Tandys:

- `POST` is used for `create`, `add` when `add` is used to create a record then add it to a relation, and for `update`
- `PATCH` is also used for `update`
- `PUT` is used for `add` when it's used to simply add a record to a relation
- `GET` is used for `find`, `findOne`, and `populate` (get related records or check an association)
- `DELETE` is used for `destroy` and `remove` (remove a record from a relation)

## Tandy Patterns
Suppose users are associated with comments via an Objection relation.  The user model associates comments in an relation named `comments`.  Here are some examples as to how the plugin will deduce which of the eight Tandys to use, based upon route method and path definition.

* `GET /users` ↦ `find`

    Returns an array of users with an `HTTP 200 OK` response.

* `GET /users/count` ↦ `find` with `/count`

    Returns the integer number of users matched with an `HTTP 200 OK` response.

* `GET /users/{id}` ↦ `findById`

    Returns user `id` with an `HTTP 200 OK` response.  Responds with an `HTTP 404 Not Found` response if the user is not found.

* `GET /users/{id}/comments` ↦ `findById`

    Returns an array of comments associated with user `id`.  Returns `HTTP 200 OK` if that user is found.  Returns an `HTTP 404 Not Found` response if that user is not found.

* `GET /users/{id}/comments/count` ↦ `populate` with `/count`

    Returns the integer number of comments associated with user `id`.  Returns `HTTP 200 OK` if that user is found.  Returns an `HTTP 404 Not Found` response if that user is not found.

* `GET /users/{id}/comments/{childId}` ↦ `populate`

    Returns `HTTP 204 No Content` if comment `childId` is associated with user `id`.  Returns an `HTTP 404 Not Found` response if that user is not found or that comment is not associated with the user.

* `POST /users` ↦ `create`

    Creates a new user using the request payload and returns it with an `HTTP 201 Created` response.

* `POST /users/{id}/comments` ↦ `add`

    Creates a new comment using the request payload and associates that comment with user `id`.  Returns that comment with an `HTTP 201 Created response`.  If that user is not found, returns an `HTTP 404 Not Found` response.

* `PUT /users/{id}/comments/{childId}` ↦ `add`

    Associates comment `childId` with user `id`.  Returns an `HTTP 204 No Content` response on success.  If the user or comment are not found, returns an `HTTP 404 Not Found` response.

* `DELETE /users/{id}` ↦ `destroy`

    Destroys user `id`.  Returns an `HTTP 204 No Content` response on success.  If the user doesn't exist, returns an `HTTP 404 Not Found` response.

* `DELETE /users/{id}/comment/{childId}` ↦ `remove`

    Removes association between user `id` and comment `childId`.  Returns an `HTTP 204 No Content` response on success.  If the user or comment doesn't exist, returns an `HTTP 404 Not Found` response.

* `PATCH /users/{id}` or `POST /user/{id}` ↦ `update`

    Updates user `id` using the request payload (which will typically only contain the attributes to update) and responds with the updated user.  Returns an `HTTP 200 OK` response on success.  If the user doesn't exist, returns an `HTTP 404 Not Found` response.


## Options
Options can be passed to the plugin when registered or defined directly on the route handler.  Those defined on the route handler override those passed to the plugin on a per-route basis.

### Acting as a User
These options allow you to act on behalf of the authenticated user.  Typically the user info is taken directly off the credentials object without checking the `Request.auth.isAuthenticated` flag.  This allows you to use authentication modes however you wish.

* `actAsUser` (boolean, defaults `false`).  Applies to `findOne`, `find`, `create`, `update`, `destroy`, `add`, `remove`, and `populate`.

    This must be set to `true` for the following options in the section to take effect.  The acting user is defined by hapi authentication credentials and the `userIdProperty` option.

* `userIdProperty` (string, defaults `"id"`).  Applies to `findOne`, `find`, `create`, `update`, `destroy`, `add`, `remove`, and `populate`.

    When `actAsUser` is `true` this option takes effect.  It defines a path into `Request.auth.credentials` to determine the acting user's id.  For example, if the credentials object equals `{user: {info: {id: 17}}}` then `"user.info.id"` would grab user id `17`.  See [`Hoek.reach`](https://github.com/hapijs/hoek#reachobj-chain-options), which is used to convert the string to a deep property in the hapi credentials object.

* `userUrlPrefix` (string, defaults `"/user"`).  Applies to `findOne`, `update`, `destroy`, `add`, `remove`, and `populate`.

    When `actAsUser` is `true` this option takes effect.  This option works in tandem with `userModel`.  When a route path begins with `userUrlPrefix` (after any other inert prefix has been stripped via the `prefix` option), the URL is transformed to begin `/:userModel/:actingUserId` before matching for a Tandy; it essentially sets the primary record to the acting user.

* `userModel` (string, defaults `"users"`).  Applies to `findOne`, `update`, `destroy`, `add`, `remove`, and `populate`.

    When `actAsUser` is `true` this option takes effect.  This option works in tandem with `userUrlPrefix`.  When a route path begins with `userUrlPrefix` (after any other inert prefix has been stripped via the `prefix` option), the URL is transformed to begin `/:userModel/:actingUserId` before matching for a Tandy; it essentially sets the primary record to the acting user.  E.g., by default when `actAsUser` is enabled, route path `PUT /user/following/10` would internally be considered as `PUT /users/17/following/10`, which corresponds to the `add` Tandy applied to the authenticated user.

### Other Options

* `prefix` (string).  Applies to `findOne`, `find`, `create`, `update`, `destroy`, `add`, `remove`, and `populate`.

    Allows one to specify a prefix to the route path that will be ignored when determining which Tandy to apply.


* `model` (string). Applies to `findOne`, `find`, `create`, `update`, `destroy`, `add`, `remove`, and `populate`.

    Name of the model's Objection identity.  If not provided as an option, it is deduced from the route path.

    Ex: `/user/1/files/3` has the model `user`.

* `associationAttr` (string). Applies to `add`, `remove`, and `populate`

    Name of the association's Objection attribute.  If not provided as an option, it is deduced from the route path.

    Ex: `/user/1/files/3` has the association attribute `files` (i.e., the Objection model `user` has an attribute, `files` containing records in a one-to-many relationship).

* `limit` (positive integer). Applies to `find` and `populate`.

    Set default limit of records returned in a list.  If not provided, this defaults to 30.

* `skip` (positive integer). Applies to `find` and `populate`.

    Sets default number of records to skip in a list (overridden by `skip` query parameter).  Defaults to 0.

* `sort` (string). Applies to `find` and `populate`.

    Sets default sorting criteria (i.e. `createdDate ASC`) (overridden by `sort` query parameter).  Defaults to no sort applied.

## Usage
Here's an (over)simplified example.

```javascript
// Assume `server` is a hapi server with the Tandy plugin registered.
// Models with identities "zoo" and "treat" exist via Schwifty.
// zoos and treats are in a many-to-many correspondence with each other.
// I suggest checking out ./test

server.route([
{ // findOne
    method: 'GET',
    path: '/zoo/{id}',
    handler: {
        tandy: options
    }
},
{ // find
    method: 'GET',
    path: '/treat',
    handler: {
        tandy: options
    }
},
{ // destroy
    method: 'DELETE',
    path: '/treat/{id}',
    handler: {
        tandy: options
    }
},
{ // create
    method: 'POST',
    path: '/zoo',
    handler: {
        tandy: options
    }
},
{ // update
    method: ['PATCH', 'POST'],
    path: '/treat/{id}',
    handler: {
        tandy: options
    }
},
{ // remove
    method: 'DELETE',
    path: '/zoo/{id}/treats/{childId}',
    handler: {
        tandy: options
    }
},
{ // create then add
    method: 'POST',
    path: '/zoo/{id}/treats',
    handler: {
        tandy: options
    }
},
{ // add
    method: 'PUT',
    path: '/zoo/{id}/treats/{childId}',
    handler: {
        tandy: options
    }
},
{ // populate
    method: 'GET',
    path: '/zoo/{id}/treats/{childId?}',
    handler: {
        tandy: options
    }
}]);
```
