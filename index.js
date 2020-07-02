const functions = require("firebase-functions");
var firebase = require("firebase");
const admin = require("firebase-admin");
var serviceAccount = require("./permissions.json");
const BASE_URL =
  "https://us-central1-cs493-final-yuansh.cloudfunctions.net/app";
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cs493-final-yuansh.firebaseio.com",
});
var db = admin.firestore();

// Your web app's Firebase configuration
var firebaseConfig = {
  apiKey: "AIzaSyAgoWJ20tZAl2UDZsp_Mha2Ek78-XeQsOo",
  authDomain: "cs493-final-yuansh.firebaseapp.com",
  databaseURL: "https://cs493-final-yuansh.firebaseio.com",
  projectId: "cs493-final-yuansh",
  storageBucket: "cs493-final-yuansh.appspot.com",
  messagingSenderId: "360314309695",
  appId: "1:360314309695:web:3831e44d819b56283dbc8a",
  measurementId: "G-R5GWNWJ43Y",
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors({ origin: true }));

async function getAdmin(id) {
  if (id) {
    const doc = await firebase.firestore().collection("admin").doc(id).get();
    let data = doc.data();
    data.id = doc.id;
    data.self = BASE_URL.concat("/admin/").concat(doc.id);
    return data;
  } else {
    const snapshot = await firebase.firestore().collection("admin").get();
    return snapshot.docs.map((doc) => {
      let data = doc.data();
      data.id = doc.id;
      data.self = BASE_URL.concat("/admin/").concat(doc.id);
      return data;
    });
  }
}
app.get("/admin", (req, res) => {
  getAdmin()
    .then((result) => {
      res.status(200).send(result);
      return null;
    })
    .catch((error) => {
      console.log(error);
    });
});

app.get("/admin/:id", (req, res) => {
  getAdmin(req.params.id)
    .then((result) => {
      res.status(200).send(result);
      return null;
    })
    .catch((error) => {
      console.log(error);
    });
});

//create admin account
app.post("/admin", (req, res) => {
  if (req.get("content-type") !== "application/json") {
    res
      .status(406)
      .json({ Error: "Server only accepts application/json data." });
  }
  if (
    !req.body.email ||
    !req.body.password ||
    !req.body.firstName ||
    !req.body.lastName ||
    Object.keys(req.body).length !== 4
  ) {
    res
      .status(400)
      .json({ Error: "cannot create admin account with given information" });
  } else {
    firebase
      .auth()
      .createUserWithEmailAndPassword(req.body.email, req.body.password)
      .then((cred) => {
        let data = {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
        };

        cred.user
          .getIdToken()
          .then((token) => {
            db.collection("admin")
              .doc(cred.user.uid)
              .set(data)
              .then(function () {
                data.id = cred.user.uid;
                data.self = BASE_URL.concat("/admin/").concat(cred.user.uid);
                data.token = token;
                res.status(201).send(data);
                return null;
              })
              .catch(function (error) {
                res.status(403).send(error);
              });
            return null;
          })
          .catch(function (error) {
            res.status(403).send(error);
          });
        return null;
      })
      .catch(function (error) {
        res.status(403).send(error);
      });
  }
});

//create a customer document
app.post("/customer", (req, res) => {
  if (req.get("content-type") !== "application/json") {
    res.status(406).send("Server only accepts application/json data.");
  }
  if (req.headers.authorization) {
    admin
      .auth()
      .verifyIdToken(req.headers.authorization.split(" ")[1])
      .then(function (decodedToken) {
        let adminID = decodedToken.uid;
        let data = {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          adminID: adminID,
          adminEmail: decodedToken.email,
        };

        db.collection("customer")
          .add(data)
          .then((ref) => {
            data.id = ref.id;
            data.self = BASE_URL.concat("/customer/").concat(ref.id);
            res.status(201).send(data);
            return null;
          })
          .catch(function (error) {
            // Handle error
            return res.status(401).send(error);
          });
        return null;
      })
      .catch(function (error) {
        // Handle error
        return res.status(401).send(error);
      });
  } else {
    res.status(401).json({ Error: "Must Log in to create customer" });
  }
});

//delete a customer document
app.delete("/:id", (req, res) => {
  res.status(405).json({ Error: "Method not allowed!" });
});
app.delete("/customer/:id", (req, res) => {
  if (req.headers.authorization) {
    admin
      .auth()
      .verifyIdToken(req.headers.authorization.split(" ")[1])
      .then(function (decodedToken) {
        firebase
          .firestore()
          .collection("customer")
          .doc(req.params.id)
          .get()
          .then((doc) => {
            if (!doc.exists) {
              res
                .status(404)
                .json({ Error: "No customer with this id exists" });
            } else if (doc.data().adminID !== decodedToken.uid) {
              res
                .status(403)
                .json({ Error: "Not authorized to delete this customer" });
            } else {
              db.collection("customer")
                .doc(req.params.id)
                .delete()
                .then(res.status(204).end())
                .catch((error) => {
                  res.status(401).send(error);
                });
            }
            return null;
          })
          .catch((error) => {
            res.status(401).send(error);
          });
        return null;
      })
      .catch(function (error) {
        res.status(401).send(error);
      });
  } else {
    res.status(401).json({ Error: "Must Log in to delete customer" });
  }
});

//read customer collection
async function getCustomer(customerID) {
  const doc = await firebase
    .firestore()
    .collection("customer")
    .doc(customerID)
    .get();
  return doc.data();
}

async function getCustomers(adminID) {
  if (adminID) {
    const snapshot = await firebase
      .firestore()
      .collection("customer")
      .where("adminID", "==", adminID)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  } else {
    const snapshot = await firebase.firestore().collection("customer").get();
    return snapshot.docs.map((doc) => doc.data());
  }
}
app.get("/customer", (req, res) => {
  if (req.headers.authorization) {
    admin
      .auth()
      .verifyIdToken(req.headers.authorization.split(" ")[1])
      .then(function (decodedToken) {
        let adminID = decodedToken.uid;
        getCustomers(adminID)
          .then((result) => {
            res.status(200).send(result);
            return null;
          })
          .catch((error) => {
            console.log(error);
          });
        return null;
      })
      .catch(function (error) {
        res.status(401).send(error);
      });
  } else {
    getCustomers()
      .then((result) => {
        res.status(200).send(result);
        return null;
      })
      .catch((error) => {
        console.log(error);
      });
  }
});

app.get("/customer/:id", (req, res) => {
  getCustomer(req.params.id)
    .then((result) => {
      res.status(200).send(result);
      return null;
    })
    .catch((error) => {
      res.status(400).json({ Error: "bad request" });
    });
});

//update a customer
app.patch("/customer/:id", (req, res) => {
  var fields = ["firstName", "lastName", "email"];

  if (req.get("content-type") !== "application/json") {
    res
      .status(406)
      .json({ Error: "Server only accepts application/json data." });
  } else if (
    Object.keys(req.body).length > 5 ||
    Object.keys(req.body).length < 1
  ) {
    res
      .status(400)
      .json({ Error: "cannot update customer with given information" });
  } else if (req.headers.authorization) {
    getCustomer(req.params.id)
      .then((customer) => {
        console.log(customer);
        admin
          .auth()
          .verifyIdToken(req.headers.authorization.split(" ")[1])
          .then(function (decodedToken) {
            let adminID = decodedToken.uid;
            if (customer.adminID !== adminID) {
              console.log(customer);
              console.log(adminID);
              res.status(401).json({
                Error: "Requested customer doesn't belong to current admin.",
              });
            } else {
              var changed = false;
              if (req.body.firstName) {
                customer.firstName = req.body.firstName;
                changed = true;
              }
              if (req.body.lastName) {
                customer.lastName = req.body.lastName;
                changed = true;
              }
              if (req.body.email) {
                customer.email = req.body.email;
                changed = true;
              }

              if (!changed) {
                customer.id = req.params.id;
                customer.self = BASE_URL.concat("/customer/").concat(
                  req.params.id
                );
                res.status(200).send(customer);
              } else {
                db.collection("customer")
                  .doc(req.params.id)
                  .update(customer)
                  .then(function () {
                    customer.id = req.params.id;
                    customer.self = BASE_URL.concat("/customer/").concat(
                      req.params.id
                    );
                    res.status(200).send(customer);
                    return null;
                  })
                  .catch(function (error) {
                    // Handle error
                    res.status(401).send("error");
                  });
              }
            }
            return null;
          })
          .catch(function (error) {
            // Handle error
            res.status(401).send("error");
          });
        return null;
      })
      .catch(function (error) {
        // Handle error
        res.status(401).send(error);
      });
  } else {
    console.log(req.params.id);
    res.status(401).send("Must Log in to update customer");
  }
});

//create a project
app.post("/customer/:id/project", (req, res) => {
  if (req.get("content-type") !== "application/json") {
    res.status(406).send("Server only accepts application/json data.");
  }
  if (req.headers.authorization) {
    admin
      .auth()
      .verifyIdToken(req.headers.authorization.split(" ")[1])
      .then(function (decodedToken) {
        let adminID = decodedToken.uid;
        let data = {
          title: req.body.title,
          status: req.body.status,
          description: req.body.description,
          adminID: adminID,
          adminEmail: decodedToken.email,
          customerID: req.params.id,
        };

        db.collection("project")
          .add(data)
          .then((ref) => {
            data.id = ref.id;
            data.self = BASE_URL.concat("/project/").concat(ref.id);
            res.status(201).send(data);
            return null;
          })
          .catch(function (error) {
            // Handle error
            res.status(401).send("error1");
          });
        return null;
      })
      .catch(function (error) {
        // Handle error
        res.status(401).send("error2");
      });
  } else {
    res.status(401).json({ Error: "Must Log in to create project" });
  }
});

//read project collection
async function getProject(id) {
  const doc = await firebase.firestore().collection("project").doc(id).get();
  return doc.data();
}

async function getProjects(customerID) {
  if (customerID) {
    const snapshot = await firebase
      .firestore()
      .collection("project")
      .where("customerID", "==", customerID)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  } else {
    const snapshot = await firebase.firestore().collection("project").get();
    return snapshot.docs.map((doc) => doc.data());
  }
}
app.get("/project", (req, res) => {
  getProjects()
    .then((result) => {
      res.status(200).send(result);
      return null;
    })
    .catch((error) => {
      console.log(error);
    });
});

app.get("/project/:id", (req, res) => {
  getProject(req.params.id)
    .then((result) => {
      res.status(200).send(result);
      return null;
    })
    .catch((error) => {
      console.log(error);
    });
});

app.get("/customer/:id/project", (req, res) => {
  getProjects(req.params.id)
    .then((result) => {
      res.status(200).send(result);
      return null;
    })
    .catch((error) => {
      res.status(400).json({ Error: "bad request" });
    });
});

app.put("/customer/:c_id/project/:p_id", (req, res) => {
  db.collection("project")
    .doc(req.params.p_id)
    .update({ customerID: req.params.c_id })
    .then(function () {
      getProject(req.params.p_id)
        .then((project) => {
          project.id = req.params.p_id;
          project.self = BASE_URL.concat("/project/").concat(req.params.p_id);
          res.status(200).send(project);
          return null;
        })
        .catch(function (error) {
          // Handle error
          res.status(401).send("error");
        });
      return null;
    })
    .catch(function (error) {
      // Handle error
      res.status(401).send("error");
    });
});

app.patch("/project/:id", (req, res) => {
  let data = {
    title: req.body.title,
    status: req.body.status,
    description: req.body.description,
  };

  db.collection("project")
    .doc(req.params.id)
    .update(data)
    .then(function () {
      getProject(req.params.id)
        .then((project) => {
          project.id = req.params.id;
          project.self = BASE_URL.concat("/project/").concat(req.params.id);
          res.status(200).send(project);
          return null;
        })
        .catch(function (error) {
          // Handle error
          res.status(401).send("error");
        });
      return null;
    })
    .catch(function (error) {
      // Handle error
      res.status(401).send("error");
    });
});

app.delete("/project/:id", (req, res) => {
  db.collection("project")
    .doc(req.params.id)
    .delete()
    .then(res.status(204).end())
    .catch(function (error) {
      // Handle error
      res.status(401).send("error");
    });
});
exports.app = functions.https.onRequest(app);
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
