// implement a double ended queue
// using a doubly linked list
// and a hash table
class doubleEndedQueue {
    constructor() {
        this.head = null;
        this.tail = null;
        this.hash = {};
    }

    // add a new node to the head of the list
    // and add it to the hash table
    addHead(key, value) {
        const node = new Node(key, value);
        if (this.head) {
            this.head.prev = node;
            node.next = this.head;
        } else {
            this.tail = node;
        }
        this.head = node;
        this.hash[key] = node;
    }

    // remove the tail of the list
    // and remove it from the hash table
    removeTail() {
        if (this.tail) {
            const key = this.tail.key;
            this.tail = this.tail.prev;
            if (this.tail) {
                this.tail.next = null;
            } else {
                this.head = null;
            }
            delete this.hash[key];
        }
    }

    // remove a node from the list
    // and remove it from the
}