const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const { on } = require('events');

require('dotenv').config();

const { DB_PORT, DB_HOST, DB_NAME, DB_USER, DB_PASS, SESSION_SECRET } = process.env;
const app = express();

// Create a MySQL database connection
const db = mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    // port: 8889,
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database');
});

// Middleware to store authentication state
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));

// Middleware to parse JSON and form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from the 'public' folder
app.use(express.static('public'));
app.use(express.json());

// Define a middleware function to check if the user is authenticated
function requireAuth(req, res, next) {
    if (req.session.isAuthenticated) {
        // If the user is authenticated, allow access
        next();
    } else {
        // If not authenticated, display a forbidden error
        res.status(403).send('Forbidden');
    }
}

// Serve the main page when accessing the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/index.html'));
});

app.get('/blog', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/blog.html'));
});

app.get('/anna-admin', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '/public/admin.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/login.html'));
});

app.get('/resume', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/resume.html'));
});

// Set up Multer to store uploaded files in a specific directory
const storage = multer.diskStorage({
    destination: 'public/uploads',
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage: storage });

// API endpoint to Edit a specific post by ID
app.get('/edit/:postId', (req, res) => {
    const postId = req.params.postId; // Get the postId from the URL
    db.query('SELECT * FROM posts WHERE postId = ?', postId, (err, results) => {
        if (err) {
            console.error('Error retrieving the post:', err);
            res.status(500).json({ error: 'Could not retrieve the post' });
            return;
        }

        if (results.length === 0) {
            // No post found with the given postId
            res.status(404).json({ error: 'Post not found' });
        } else {
            // Send the post data as JSON
            res.status(200).json(results[0]);
        }
    });
});

function calculateWordCount(content) {
    // Use regular expressions to split text into words (space-separated)
    const words = content.split(/\s+/);
    return words.length;
}

function calculateReadingTime(wordCount) {
    // Average reading speed: 200 words per minute (1 word per 0.3 seconds)
    const wordsPerMinute = 130;
    const minutes = wordCount / wordsPerMinute;
    const seconds = minutes * 60;
    return (Math.round(minutes) + " MIN");
}

// API endpoint to retrieve a specific post by ID
app.get('/posts/:postId', (req, res) => {
    const postId = req.params.postId;
    db.query('SELECT * FROM posts WHERE postId = ?', postId, (err, results) => {
        if (err) {
            console.error('Error retrieving the post:', err);
            res.status(500).json({ error: 'Could not retrieve the post' });
            return;
        }

        if (results.length === 0) {
            // No post found with the given postId
            res.status(404).json({ error: 'Post not found' });
        } else {
            const post = results[0];
            const inputDateString = post.postDate;
            const inputDate = new Date(inputDateString);
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            const formattedDate = new Intl.DateTimeFormat('en-US', options).format(inputDate);
            const wordCount = calculateWordCount(post.postContent);
            const readingTime = calculateReadingTime(wordCount);
            
            post.postType == null ? (typeClass = "", post.postType = "") : typeClass = "post_type";

            const htmlTemplate = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="../css/main.css">
                <link rel="shortcut icon" href="../images/favicon.jpg" type="image/x-icon">
                <title>${post.postTitle}</title>
            </head>
            <body>
                <nav class="navbar">
                    <ul class="navbar-nav me-auto">
                        <li class="nav-item">
                            <img class="logo" src="../images/favicon.jpg" alt="" srcset="">
                            <a aria-current="page" href="/">Anna Kozh</a>
                        </li>
                        <li class="nav-item">
                            <a aria-current="page" href="/">Portfolio</a>
                        </li>
                        <li class="nav-item">
                            <a aria-current="page" href="/blog">Blog</a>
                        </li>
                        <li class="nav-item icon download" style="background: url(./images/cloud-arrow-down-solid.svg) no-repeat;">
                            <a class="resume-placeholder" href="">
                            R&#233sum&#233</a>
                        </li>              
                    </ul>
                </nav>
                <div class="loader-bar" id="loader-bar"></div>
                <div id="singlePost">
                    <div class="post-stats">
                        <span>${formattedDate}</span>
                        <span>${readingTime} READ</span>
                        <span class="${typeClass}">${post.postType}</span>
                    </div>
                    <h1>${post.postTitle}</h1>
                    <h4>${post.postDescription}</h4>
                    <p>${post.postContent}</p>
                </div>
                <footer>
                    <h3>Get in touch</h3>
                    <a href="https://www.linkedin.com/in/anna-kozhevnikova/" target="_blank">LinkedIn</a>
                    <a id="emailCopy" onclick="copy()">
                    <span class="tooltiptext" id="tooltip"></span>
                    annakozh@gmail.com
                    </a>
                </footer>
                <script src="../js/loader.js"></script>
            </body>
            </html>
            `;

            // Send the HTML template as the response
            res.send(htmlTemplate);
        }
    });
});

// Route to handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Query the database to check if the provided username and password match
    db.query('SELECT * FROM users WHERE userName = ? AND userPass = ?', [username, password], (err, results) => {
        if (err) {
            console.error('Error checking login credentials:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length === 1) {
            // Successful login, set the isAuthenticated property and redirect to the admin page
            req.session.isAuthenticated = true;
            res.redirect('/anna-admin');
        } else {
            // Invalid credentials, redirect back to the login page
            res.redirect('/login');
        }
    });
});

app.post('/addOrEditPost', upload.single('postImage'), (req, res) => {
    const { postId, postTitle, postDescription, postContent, postPromoted, postDate, postType, postDeleted } = req.body;
    let postImage = req.file ? req.file.filename : null; // Initialize postImage

    if (postId) {
        handlePostUpdate(postId, postTitle, postDescription, postContent, postPromoted, postDate, postType, postImage, res, postDeleted);
    } else {
        handlePostCreation(res, postTitle, postDescription, postContent, postImage, postPromoted, postDate, postType, postDeleted);
    }
});

function handlePostUpdate(postId, postTitle, postDescription, postContent, postPromoted, postDate, postType, postImage, res) {
    // Check if a new image was uploaded or not
    if (!postImage) {
        // If no new image is uploaded, retrieve the existing image from the database
        retrievePostImage(postId, (existingImage) => {
            // Continue with the update logic
            updatePost(postId, postTitle, postDescription, postContent, postPromoted, postDate, postType, existingImage, res);
        });
    } else {
        // If a new image is uploaded, continue with the update logic
        updatePost(postId, postTitle, postDescription, postContent, postPromoted, postDate, postType, postImage, res);
    }
}

function retrievePostImage(postId, callback) {
    db.query('SELECT postImage FROM posts WHERE postId = ?', postId, (err, result) => {
        if (err) {
            console.error('Error retrieving post image:', err);
            res.status(500).json({ error: 'Could not retrieve the post image' });
            return;
        }
        const existingImage = result.length > 0 ? result[0].postImage : null;
        callback(existingImage);
    });
}

function updatePost(postId, postTitle, postDescription, postContent, postPromoted, postDate, postType, postImage, res) {
    // Edit an existing post based on postId
    const updatedPost = { postTitle, postDescription, postContent, postPromoted, postType, postImage };
    db.query('UPDATE posts SET ? WHERE postId = ?', [updatedPost, postId], (err, results) => {
        if (err) {
            console.error('Error updating the post:', err);
            // Access the response object directly
            res.status(500).json({ error: 'Could not update the post' });
            return;
        }

        // Send a success response for editing
        res.status(200).json({ message: 'Post updated successfully' });
    });
}

function handlePostCreation(res, postTitle, postDescription, postContent, postImage, postPromoted, postDate, postType, postDeleted) {
    // Create a new post
    const newPost = { postTitle, postDescription, postContent, postImage, postPromoted, postDate, postType, postDeleted };
    db.query('INSERT INTO posts SET ?', newPost, (err, result) => {
        if (err) {
            console.error('Error creating the post:', err);
            res.status(500).json({ error: 'Could not create the post' });
            return;
        }
        // Send a success response for creating
        res.status(200).json({ message: 'Post created successfully' });
    });
}

// API endpoint to delete a specific post by ID
app.post('/deletePost/:postId', (req, res) => {
    const postId = req.params.postId;
    
    // Execute an UPDATE query to mark the post as deleted
    db.query('UPDATE posts SET postDeleted = 1 WHERE postId = ?', postId, (err, results) => {
        if (err) {
            console.error('Error updating postDeleted status:', err);
            res.status(500).json({ error: 'Could not update postDeleted status' });
        } else {
            db.query('INSERT INTO archived_posts SELECT * FROM posts WHERE postId = ?', postId, (err, result) => {
                if (err) {
                    console.error('Error archiving the post:', err);
                    res.status(500).json({ error: 'Could not archive the post' });
                    return;
                }
        
                // Delete the post from the 'posts' table
                db.query('DELETE FROM posts WHERE postId = ?', postId, (err, result) => {
                    if (err) {
                        console.error('Error deleting the post from the main table:', err);
                        res.status(500).json({ error: 'Could not delete the post from the main table' });
                        return;
                    }
        
                    // Send a success response for archiving
                    res.status(200).json({ message: 'Post archived successfully' });
                });
            });
            
            res.status(200).json({ message: 'Post marked as deleted successfully' });
        }
    });

    
});

// API endpoint to retrieve archived posts
app.get('/archived-posts', (req, res) => {
    // Query the database to fetch archived posts
    db.query('SELECT * FROM archived_posts', (err, results) => {
        if (err) {
            console.error('Error retrieving archived posts:', err);
            res.status(500).json({ error: 'Could not retrieve archived posts' });
            return;
        }

        // Send the list of archived posts as JSON
        res.status(200).json(results);
    });
});

// Archive a post
app.post('/archivePost/:postId', (req, res) => {
    const postId = req.params.postId;
    // Move the post from the 'posts' table to the 'archived_posts' table
    db.query('INSERT INTO archived_posts SELECT * FROM posts WHERE postId = ?', postId, (err, result) => {
        if (err) {
            console.error('Error archiving the post:', err);
            res.status(500).json({ error: 'Could not archive the post' });
            return;
        }

        // Delete the post from the 'posts' table
        db.query('DELETE FROM posts WHERE postId = ?', postId, (err, result) => {
            if (err) {
                console.error('Error deleting the post from the main table:', err);
                res.status(500).json({ error: 'Could not delete the post from the main table' });
                return;
            }

            // Send a success response for archiving
            res.status(200).json({ message: 'Post archived successfully' });
        });
    });
});

// Unarchive a post
app.post('/unarchivePost/:postId', (req, res) => {
    const postId = req.params.postId;
    // Move the post from the 'archived_posts' table back to the 'posts' table
    db.query('INSERT INTO posts SELECT * FROM archived_posts WHERE postId = ?', postId, (err, result) => {
        if (err) {
            console.error('Error unarchiving the post:', err);
            res.status(500).json({ error: 'Could not unarchive the post' });
            return;
        }

        // Delete the post from the 'archived_posts' table
        db.query('DELETE FROM archived_posts WHERE postId = ?', postId, (err, results) => {
            if (err) {
                console.error('Error deleting the post from the archived table:', err);
                res.status(500).json({ error: 'Could not delete the post from the archived table' });
                return;
            }

            // Send a success response for unarchiving
            res.status(200).json({ message: 'Post unarchived successfully' });
        });
    });
});

// API endpoint to publish/unpublish a specific post by ID
app.post('/publishPost/:postId/:published', (req, res) => {
    const { postId, published } = req.params;
    const updateStatus = published === '1' ? 1 : 0;

    db.query('UPDATE posts SET postPublished = ? WHERE postId = ?', [updateStatus, postId], (err, result) => {
        if (err) {
            console.error('Error updating post publish status:', err);
            res.status(500).json({ error: 'Could not update the publish status' });
            return;
        }

        res.status(200).json({ success: true });
    });
});

// API endpoint to retrieve published posts, ordered by promotion status and date
app.get('/publishedPosts', (req, res) => {
    db.query('SELECT * FROM posts WHERE postPublished = 1 AND postDeleted = 0 ORDER BY postPromoted ASC, postDate ASC', (err, results) => {
        if (err) {
            console.error('Error retrieving published posts:', err);
            res.status(500).json({ error: 'Could not retrieve published posts' });
            return;
        }

        // Send the list of published posts as JSON, ordered by promotion and date
        res.status(200).json(results);
    });
});

// API endpoint to retrieve all posts
app.get('/posts', (req, res) => {
    // Query the database to fetch all posts
    db.query('SELECT * FROM posts WHERE postDeleted = 0 ORDER BY postPromoted ASC', (err, results) => {
        if (err) {
            console.error('Error retrieving posts:', err);
            res.status(500).json({ error: 'Could not retrieve posts' });
            return;
        }

        // Send the list of posts as JSON
        res.status(200).json(results);
    });
});

app.listen(DB_PORT, () => {
    console.log(`Server is running on http://localhost:${DB_PORT}`);
});
