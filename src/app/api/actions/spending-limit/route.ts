import {
    ActionPostResponse,
    createActionHeaders,
    createPostResponse,
    ActionGetResponse,
    ActionPostRequest,
  } from "@solana/actions";
import * as multisig from "@sqds/multisig";
import { Connection, PublicKey, VersionedTransaction, TransactionMessage, Keypair } from "@solana/web3.js";
import { Transaction, TransactionInstruction } from "@solana/web3.js";

const headers = createActionHeaders({
    chainId: "devnet", 
    actionVersion: "2.2.1", 
});

const connection = new Connection("https://api.devnet.solana.com");

export const GET = async (req: Request) => {
    const payload: ActionGetResponse = {
        title: "Set Spending Limit",
        icon: 'https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88ec48bb1f43/-/preview/880x864/-/quality/smart/-/format/auto/',
        description: "Set, reset, or revoke a spending limit for your wallet",
        label: "Manage Spending Limit",
        links: {
            actions: [
                {
                    label: "Set Limit",
                    href: "/api/actions/spending-limit?action=set",
                    parameters: [
                        {
                            name: "amount",
                            label: "Enter limit amount (in SOL)",
                        },
                    ],
                },
                {
                    label: "Reset Limit",
                    href: "/api/actions/spending-limit?action=reset",
                    parameters: [
                        {
                            name: "amount",
                            label: "Enter new limit amount (in SOL)",
                        },
                    ],
                },
                {
                    label: "Revoke Limit",
                    href: "/api/actions/spending-limit?action=revoke",
                },
            ],
        },
    };

    return Response.json(payload, { headers });
}

export const OPTIONS = GET;

export const POST = async (req: Request) => {
    const body: ActionPostRequest = await req.json();
    const action = req.url.split("?")[1].split("=")[1];
    console.log(body);
    const amount  = body.data.amount;
    const userPublicKey = new PublicKey(body.account);

    console.log(`Action: ${action} Amount: ${amount} Account: ${userPublicKey}`);

    const creator = userPublicKey;

    const createKey = userPublicKey;

    const multisigPda = multisig.getMultisigPda({
      createKey: createKey,
    })[0];

    let transaction: Transaction;
    let resetTransaction: VersionedTransaction;
    let setTransaction: VersionedTransaction;
    let payload: ActionPostResponse;

    const connection = new Connection("https://api.devnet.solana.com");

    switch (action) {
        case 'set':
            let createMultisigInstruction = createMultisig(connection, createKey, multisigPda, userPublicKey, Number(amount));
            let addSpendingLimitInstruction= setSpendingLimit(connection, multisigPda, userPublicKey, Number(amount));
            transaction = new Transaction().add(createMultisigInstruction, addSpendingLimitInstruction);
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            transaction.feePayer = userPublicKey;
            payload = await createPostResponse({
              headers: headers,
              fields: {
                  transaction: transaction,
                  message: `Spending limit ${action}`,
              },
          });
            break;
        // case 'reset':
        //     [resetTransaction, setTransaction] = await resetSpendingLimit(connection, multisigPda, userPublicKey, Number(amount));
        //     payload = await createPostResponse({
        //       fields: {
        //           transactions: [
        //             resetTransaction.serialize(),
        //             setTransaction.serialize()
        //           ],
        //           message: `Spending limit ${action}`,
        //       },
        //   });
        //     break;
        // case 'revoke':
        //     transaction = await revokeSpendingLimit(connection, multisigPda, userPublicKey);
        //     payload = await createPostResponse({
        //       fields: {
        //           transaction: transaction.serialize(),
        //           message: `Spending limit ${action}`,
        //       },
        //   });
            // break;
        default:
            throw new Error('Invalid action');
    }

    return Response.json(payload, { headers });
};

// async function createConfigTransaction(connection: Connection, createKey: PublicKey, multisigPda: PublicKey, userPublicKey: PublicKey, amount: number): Promise<TransactionInstruction>  {
//   const configTransaction = multisig.instructions.configTransactionCreate({
//     multisigPda,
//     creator: userPublicKey,
//     transactionIndex: BigInt(1),
//     actions: [{
//       __kind: "ChangeThreshold",
//       newThreshold: 0
//     }],
//     programId: multisig.PROGRAM_ID
//   });

//   return configTransaction;
  
// }
function createMultisig(connection: Connection, createKey: PublicKey, multisigPda: PublicKey, userPublicKey: PublicKey, amount: number): TransactionInstruction {

  console.log(`multisig programID ${multisig.PROGRAM_ID}`);
  console.log(`createKey ${createKey}`);
  console.log(`multisigPda ${multisigPda}`);
  console.log(`userPublicKey ${userPublicKey}`);
  console.log(`amount ${amount}`);

  const createMultisigInstruction = multisig.instructions.multisigCreateV2({
    treasury: PublicKey.unique(),
    creator: userPublicKey,
    multisigPda,
    configAuthority: null,
    threshold: 1,
    members: [{ key: userPublicKey, permissions: multisig.types.Permissions.all() }],
    timeLock: 0,
    rentCollector: null,
    createKey,
    programId: multisig.PROGRAM_ID
  });

  return createMultisigInstruction;
}

function setSpendingLimit(connection: Connection, multisigPda: PublicKey, userPublicKey: PublicKey, amount: number): TransactionInstruction {
    const createKey = PublicKey.unique();
    const spendingLimitPda = multisig.getSpendingLimitPda({ multisigPda, createKey })[0];
  
    const addSpendingLimitInstruction = multisig.instructions.multisigAddSpendingLimit({
        multisigPda,
        spendingLimit: spendingLimitPda,
        createKey,
        rentPayer: userPublicKey,
        amount: BigInt(amount * 1e9), // Convert SOL to lamports
        period: multisig.types.Period.Day,
        mint: PublicKey.default, // Use default PublicKey for SOL
        destinations: [], // Empty array for any destination
        members: [userPublicKey], // Apply limit only to the user
        vaultIndex: 0,
        configAuthority: userPublicKey, 
    });

    return addSpendingLimitInstruction;
}

// async function resetSpendingLimit(connection: Connection, multisigPda: PublicKey, userPublicKey: PublicKey, newAmount: number): Promise<VersionedTransaction[]> {
//     // Find existing spending limit
//     const spendingLimits = await connection.getProgramAccounts(multisig.PROGRAM_ID, {
//         filters: [
//             { memcmp: { offset: 8, bytes: multisigPda.toBase58() } },
//             { memcmp: { offset: 40, bytes: userPublicKey.toBase58() } },
//         ],
//     });

//     if (spendingLimits.length === 0) {
//         return ActionErrorResponse({
//           error: {
//             message: 'No existing spending limit found'
//           },
//           disabled: true
//         });
//     }

//     const existingLimit = spendingLimits[0].pubkey;

//     // Remove the existing limit
//     const removeVersionedTx = multisig.transactions.multisigRemoveSpendingLimit({
//         blockhash: (await connection.getLatestBlockhash()).blockhash,
//         feePayer: userPublicKey,
//         multisigPda,
//         spendingLimit: existingLimit,
//         configAuthority: PublicKey.default, // Use default PublicKey instead of null
//         rentCollector: userPublicKey,
//     });

//     // Set the new limit
//     const setVersionedTx =  multisig.instructions.multisigAddSpendingLimit({
//         blockhash: (await connection.getLatestBlockhash()).blockhash,
//         feePayer: userPublicKey,
//         multisigPda,
//         spendingLimit: multisig.getSpendingLimitPda({ multisigPda, createKey: PublicKey.unique() })[0],
//         configAuthority: PublicKey.default, // Use default PublicKey instead of null
//         createKey: PublicKey.unique(),
//         rentPayer: userPublicKey,
//         amount: BigInt(newAmount * 1e9),
//         period: multisig.types.Period.Day,
//         mint: PublicKey.default,
//         destinations: [],
//         members: [userPublicKey],
//         vaultIndex: 0,
//     });
//     // Combine the transactions

//     return [removeVersionedTx, setVersionedTx];

// }

// async function revokeSpendingLimit(connection: Connection, multisigPda: PublicKey, userPublicKey: PublicKey): Promise<VersionedTransaction> {
//     // Find existing spending limit
//     const spendingLimits = await connection.getProgramAccounts(multisig.PROGRAM_ID, {
//         filters: [
//             { memcmp: { offset: 8, bytes: multisigPda.toBase58() } },
//             { memcmp: { offset: 40, bytes: userPublicKey.toBase58() } },
//         ],
//     });

//     if (spendingLimits.length === 0) {
//         throw new Error('No existing spending limit found');
//     }

//     const existingLimit = spendingLimits[0].pubkey;

//     const versionedTx = await multisig.transactions.multisigRemoveSpendingLimit({
//         blockhash: (await connection.getLatestBlockhash()).blockhash,
//         feePayer: userPublicKey,
//         multisigPda,
//         spendingLimit: existingLimit,
//         configAuthority: PublicKey.default, // Use default PublicKey instead of null
//         rentCollector: userPublicKey,
//     });

//     return versionedTx;
// }