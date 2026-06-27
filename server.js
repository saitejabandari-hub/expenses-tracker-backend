const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")

dotenv.config();

const connectDB = require("./config/db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Expense Tracker API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

connectDB();


const transactionSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
        
    },

    description: {
        type: String,
        required:true
    },
    amount:{
        type:Number,
        required:true
    },
    category:{
        type:String,
        required:true
    },
    type:{
        type:String,
        required:true
    },
    paymentMethod:{
        type:String,
        required:true
    },
    date:{
        type:Date,
         required:true
    }
});

const Transaction = mongoose.model("Transaction",transactionSchema);

const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    profileImage:{
        type:String
    },
    number:{
        type:Number
    }
})

const User = mongoose.model("User",userSchema)

module.exports = User

//creatUser

app.post("/createuser",async(request,response)=>{

    try{
        const {name,password,email,profileImage}=request.body

        const checkuser = await User.findOne({email})

        if(checkuser){
            return response.status(400).json({message:"email exists"})
        }

        const hashedpassword = await bcrypt.hash(password,10)
        const profile = await User.create({
            name,
            email,
            profileImage,
            password:hashedpassword
        })

        response.status(201).json({
                message: "User created successfully"
            })

    }catch(error){
        response.status(500).send(error.message)
    }
})

//middleware

const authmiddleware = (request,response,next)=>{

    const authheader = request.headers.authorization

    if(!authheader){
        return response.status(401).send("Token is missing")
    }

    const token = authheader.split(" ")[1]

   try{
     const decode = jwt.verify(
        token,
        process.env.JWT_SECRET
    )

    request.user = decode 

    next()
   }catch(error){
      response.status(401).send("Token is missing")
   }


}


//Login user 

app.post("/user", async (request,response)=>{

    try{

        const{email,password} = request.body

        const user = await User.findOne({email})

        if(!user){
           return response.status(400).json({message:"User Not Found"})
        }

         const isMatch = await bcrypt.compare(password,user.password)

        if (!isMatch) {
      return response.status(400).json({
           message: "Invalid Password"
    })
}

        const token = jwt.sign(
            {
                userId:user._id
            },
            process.env.JWT_SECRET,
            {
                expiresIn:"30d"
            }
        )

        response.status(200).json({message:"Login Success",token})

    }catch(error){
        response.status(500).send(error.message)
    }

})

//get user 

app.get("/getuser",authmiddleware,async(request,response)=>{

    try{

        const userdetails = await User.findOne({_id:request.user.userId})

        response.send(userdetails)

    }catch(error){
        response.status(401).send(error.message)
    }
})

//update user 

app.put("/updateuser",authmiddleware,async(request,response)=>{

    try{

        await User.updateOne({_id:request.user.userId},request.body)

    }catch(error){
        response.status(500).send(error.message)
    }

    response.send("updated successful")

})

//update password 

app.put("/updatepassword",authmiddleware,async(request,response)=>{

    try{

        const{oldpassword,newpassword}=request.body 

        const user = await User.findOne({_id:request.user.userId})

        const ismatch = await bcrypt.compare(oldpassword,user.password)

        if(!ismatch){
           return response.status(401).send("Incorrect Password")
        }

        const hashedpassword = await bcrypt.hash(newpassword,10)

        await User.updateOne({_id:request.user.userId},{password:hashedpassword})
        
        response.send("password updated")

    }catch(error){
        response.status(500).send(error.message)
    }
})

//get all transaction

app.get("/transaction",authmiddleware,async (request,response)=>{


   try{

    const transaction = await Transaction.find({userId:request.user.userId}.sort({date:1}))

         response.send(transaction)
     
   } catch (error){
    response.status(500).send(error.message)
   }
})

//post transaction

app.post("/addtransaction",authmiddleware,async(request,response)=>{

try{

 

    const userId = request.user.userId

    const transaction = await Transaction.create({...request.body,userId})
    console.log(transaction)

    response.send(transaction)
    } catch (error){
    response.status(500).send(error.message)
   }
})

//delete transaction

app.delete("/deletetransaction/:id",authmiddleware,async(request,response)=>{
    try {

        const checkuser = await Transaction.findOne({_id:request.params.id,userId:request.user.userId})

        if(checkuser){
            await Transaction.deleteOne({_id:request.params.id});

        }
        
    response.send("Transaction Deleted");
    } catch (error){
    response.status(500).send(error.message)
   }
})

//get transaction with id 

app.get("/gettransaction/:id",authmiddleware,async(request,response)=>{
    try{

        const tran = await Transaction.findOne({userId:request.user.userId,_id:request.params.id})
        if(!tran){
            return response.status(401).send("failed to find")
        }
            response.status(200).send(tran)

    }catch(error){
        response.status(500).send(error.message)
    }
})

// update transaction

app.put("/updatetransaction/:id",authmiddleware,async (request,response)=>{
    try{

    await Transaction.updateOne({
        _id:request.params.id},
        {$set: request.body}  
    )
     response.send("Transaction Updated");

    } catch (error){
    response.status(500).send(error.message)
   }
})

// delete all

app.delete("/deleteall",async (request,response)=>{
    await Transaction.deleteMany({})

    response.send("cleared all data")
})

// get transaction according to the date 

app.get("/filtertransaction",authmiddleware,async(request,response)=>{
try{

    const userId = request.user.userId 
    const {month,year} = request.query

    const numMonth = Number(month)
    const numYear = Number(year)

    const startdate = new Date(numYear,numMonth -1,1)
    const enddate = new Date(numYear,numMonth,1)

    const filteredTransaction = await Transaction.find({
        userId,
        date:{$gte: startdate,
            $lt : enddate
                             }
    }).sort({date:1})

    if(filteredTransaction.length === 0){
        return response.status(404).json({
            message: "No Transaction Found"
        })
    }

    response.status(200).send(filteredTransaction)


}catch(error){
    response.status(500).send(error.message)
}

})